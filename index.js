const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const schedule = require("node-schedule");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

const io = socketIo(server, {
  cors: { origin: "http://localhost:3000", credentials: true },
});

//Connect to mqtt
var mqtt = require("mqtt");

var options = {
  host: process.env.MQTT_HOST,
  port: process.env.MQTT_PORT,
  protocol: "mqtts",
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
};

// initialize the MQTT client
var mqtt_client = mqtt.connect(options);

// setup the callbacks
mqtt_client.on("connect", function () {
  console.log("Connected");
});

mqtt_client.on("error", function (error) {
  console.log(error);
});

mqtt_client.on("message", function (topic, message) {
  const validJsonString = message.toString().replace(/'/g, '"');

  const jsonObject = JSON.parse(validJsonString);

  io.emit("mqtt-message", { topic, message: jsonObject });
});

// subscribe to topic 'my/test/topic'
mqtt_client.subscribe("my/test/topic");
mqtt_client.subscribe("gps");
mqtt_client.subscribe("mpu");

const job = schedule.scheduleJob("* /1 * * * *", function () {
  console.log("The answer to life, the universe, and everything!");
});

app.get("/", (req, res) => {
  res.send("Socket.IO server running");
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(8000, () => {
  console.log("Server listening on port 8000");
});
