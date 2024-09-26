const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const { InfluxDBClient, Point } = require("@influxdata/influxdb3-client");

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
  // called each time a message is received
  console.log("Received message:", topic, message.toString());
  io.emit("mqtt-message", { topic, message: message.toString() });
});

// subscribe to topic 'my/test/topic'
mqtt_client.subscribe("my/test/topic");

// สร้าง InfluxDB client โดยใช้ environment variables
const client = new InfluxDBClient({
  host: "https://us-east-1-1.aws.cloud2.influxdata.com",
  token:
    "jpMFNwx0dwjPpOoTXfhYB2RmcaN6z9oGqGqupOI2gDMEm55dgSXJSaiHND-2RC2VBRmjv2uliXg1teuwHXjJrw==",
});

async function uploadGyroscope(location, x, y, z) {
  const gyroscopePoint = Point.measurement("gyroscope")
    .setTag("location", location)
    .setFloatField("x", x)
    .setFloatField("y", y)
    .setFloatField("z", z)
    .setTimestamp(new Date());

  await client.write(gyroscopePoint, "wireless");
}

async function uploadGPS(location, latitude, longitude, altitude) {
  const gpsPoint = Point.measurement("gps")
    .setTag("location", location)
    .setFloatField("latitude", latitude)
    .setFloatField("longitude", longitude)
    .setFloatField("altitude", altitude)
    .setTimestamp(new Date());

  await client.write(gpsPoint, "wireless");
}

/**
 * ฟังก์ชันปิดการเชื่อมต่อ
 */
async function closeConnection() {
  try {
    await client.close();
    console.log("Data uploaded successfully!");
  } catch (err) {
    console.error("Error uploading data: ", err);
  }
}

// ตัวอย่างการอัพโหลดข้อมูลหลายรอบ
async function uploadData() {
  // อัพโหลดข้อมูล Gyroscope
  uploadGyroscope("office", 0.12, -0.34, 1.01);
  uploadGyroscope("office", 0.15, -0.3, 1.02); // อัพโหลดรอบที่สอง

  // อัพโหลดข้อมูล GPS
  uploadGPS("car", 13.7563, 100.5018, 5.2);
  uploadGPS("car", 13.758, 100.503, 5.5); // อัพโหลดรอบที่สอง

  // ปิดการเชื่อมต่อเมื่ออัพโหลดเสร็จ
  await closeConnection();
}

uploadData();

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
