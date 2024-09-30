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
  // io.emit("mqtt-message", { topic, message: message.toString() });

  const validJsonString = message.toString().replace(/'/g, '"');

  const jsonObject = JSON.parse(validJsonString);
  console.log(jsonObject);

  let date = new Date();

  uploadGyroscope(
    jsonObject.gyroscope.x,
    jsonObject.gyroscope.y,
    jsonObject.gyroscope.z,
    date
  );
  uploadAccelerometer(
    jsonObject.accelerometer.x,
    jsonObject.accelerometer.y,
    jsonObject.accelerometer.z,
    date
  );

  io.emit("mqtt-message", { topic, message: jsonObject });
});

// subscribe to topic 'my/test/topic'
mqtt_client.subscribe("mpu");

// สร้าง InfluxDB client โดยใช้ environment variables
const client = new InfluxDBClient({
  host: process.env.INFLUXDB_URL,
  token: process.env.INFLUXDB_TOKEN,
});

// async function uploadValue(s, x, y, z, date) {
//   let val = Math.sqrt(x * x + y * y + z * z);
//   const ValPoint = Point.measurement(s)
//     .setFloatField("val", val)
//     .setTimestamp(date);

//   await client.write(ValPoint, "wireless");
// }

async function uploadGyroscope(x, y, z, date) {
  let magnitude = Math.sqrt(x * x + y * y + z * z);

  const gyroscopePoint = Point.measurement("gyroscope")
    .setFloatField("x", x)
    .setFloatField("y", y)
    .setFloatField("z", z)
    .setFloatField("magnitude", magnitude)
    .setTimestamp(date);

  await client.write(gyroscopePoint, "wireless");
}

async function uploadAccelerometer(x, y, z, date) {
  let magnitude = Math.sqrt(x * x + y * y + z * z);

  const accelerometerPoint = Point.measurement("accelerometer")
    .setFloatField("x", x)
    .setFloatField("y", y)
    .setFloatField("z", z)
    .setFloatField("magnitude", magnitude)
    .setTimestamp(date);

  await client.write(accelerometerPoint, "wireless");
}

async function uploadGPS(latitude, longitude, altitude) {
  const gpsPoint = Point.measurement("gps")
    .setFloatField("latitude", latitude)
    .setFloatField("longitude", longitude)
    .setFloatField("altitude", altitude)
    .setTimestamp(new Date());

  await client.write(gpsPoint, "wireless");
}

// // ตัวอย่างการอัพโหลดข้อมูลหลายรอบ
// async function uploadData() {
//   // อัพโหลดข้อมูล Gyroscope
//   uploadGyroscope("office", 0.12, -0.34, 1.01);
//   uploadGyroscope("office", 0.15, -0.3, 1.02); // อัพโหลดรอบที่สอง

//   // อัพโหลดข้อมูล GPS
//   uploadGPS("car", 13.7563, 100.5018, 5.2);
//   uploadGPS("car", 13.758, 100.503, 5.5); // อัพโหลดรอบที่สอง
// }

// uploadData();

app.get("/", (req, res) => {
  res.send("Socket.IO server running");
});

app.get("/data", async (req, res) => {
  const query = "";

  try {
    const rows = await client.query(query, "wireless");
    const formattedRows = rows.map((row) => ({
      time: row._time,
      x: row.x,
      y: row.y,
      z: row.z,
    }));

    res.json(formattedRows); // Send the data as a JSON response
  } catch (error) {
    console.error("Error querying data:", error);
    res.status(500).send("Error querying data");
  }
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
