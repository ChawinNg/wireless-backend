const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const schedule = require("node-schedule");
require("dotenv").config();
const { Point, InfluxDB } = require("@influxdata/influxdb-client");

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

mqtt_client.on("message", async function (topic, message) {
  // called each time a message is received
  // console.log("Received message:", topic, message.toString());
  // io.emit("mqtt-message", { topic, message: message.toString() });

  if (topic === "mpu") {
    const validJsonString = message.toString().replace(/'/g, '"');

    const jsonObject = JSON.parse(validJsonString);
    // console.log(jsonObject);

    let date = new Date();

    const gyroscopeMagnitude = await uploadGyroscope(
      jsonObject.gyroscope.x,
      jsonObject.gyroscope.y,
      jsonObject.gyroscope.z,
      date
    );
    const accelerometerMagnitude = await uploadAccelerometer(
      jsonObject.accelerometer.x,
      jsonObject.accelerometer.y,
      jsonObject.accelerometer.z,
      date
    );

    console.log(jsonObject);

    if (gyroscopeMagnitude > 120 && accelerometerMagnitude > 10) {
      io.emit("alert", { message: true });
    }
    io.emit("mqtt-message", { topic, message: jsonObject });
  } else if (topic === "gps") {
    const validJsonString = message.toString().replace(/'/g, '"');
    const jsonObject = JSON.parse(validJsonString);
    io.emit("mqtt-message", { topic, message: jsonObject });
    // uploadGPS(jsonObject.latitude, jsonObject.longitude, jsonObject.altitude);
    // io.emit("mqtt-message", { topic, message: jsonObject });
  }
});

// subscribe to topic 'my/test/topic'
mqtt_client.subscribe("mpu");
// mqtt_client.subscribe("gps");
// mqtt_client.subscribe("gps");

const job = schedule.scheduleJob("* /1 * * * *", function () {
  console.log("The answer to life, the universe, and everything!");
});

// สร้าง InfluxDB client โดยใช้ environment variables
const client = new InfluxDB({
  url: process.env.INFLUXDB_URL,
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
  const writeApi = client.getWriteApi(
    process.env.INFLUXDB_ORG,
    process.env.INFLUXDB_BUCKET
  );
  const magnitude = Math.sqrt(y * y + z * z);
  const point = new Point("gyroscope")
    .floatField("x", x)
    .floatField("y", y)
    .floatField("z", z)
    .floatField("magnitude", magnitude)
    .timestamp(date);
  writeApi.writePoint(point);
  writeApi
    .close()
    .then(() => console.log("write point success"))
    .catch((error) => console.error(error));
  return magnitude;
}

async function uploadAccelerometer(x, y, z, date) {
  const writeApi = client.getWriteApi(
    process.env.INFLUXDB_ORG,
    process.env.INFLUXDB_BUCKET
  );
  const magnitude = Math.abs(x);
  const point = new Point("accelerometer")
    .floatField("x", x)
    .floatField("y", y)
    .floatField("z", z)
    .floatField("magnitude", magnitude)
    .timestamp(date);
  writeApi.writePoint(point);
  writeApi
    .close()
    .then(() => console.log("write point success"))
    .catch((error) => console.error(error));
  return magnitude;
}

async function uploadGPS(latitude, longitude, altitude) {
  const writeApi = client.getWriteApi(
    process.env.INFLUXDB_ORG,
    process.env.INFLUXDB_BUCKET
  );
  const point = new Point("gps")
    .floatField("latitude", latitude)
    .floatField("longitude", longitude)
    .floatField("altitude", altitude)
    .timestamp(new Date());
  writeApi.writePoint(point);
  writeApi
    .close()
    .then(() => console.log("write point success"))
    .catch((error) => console.error(error));
}

function getMaxMagnitudePerMinute(events) {
  const maxMagnitudes = {};

  events.forEach((event) => {
    const date = new Date(event._time);
    const minute = date.toISOString().slice(0, 16); // Get the year, month, day, hour, and minute

    if (!maxMagnitudes[minute] || event.magnitude > maxMagnitudes[minute]) {
      maxMagnitudes[minute] = event.magnitude;
    }
  });

  return maxMagnitudes;
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

app.get("/accelerometer", async (req, res) => {
  const queryApi = client.getQueryApi(process.env.INFLUXDB_ORG);
  const query = `
    from(bucket: "wireless")
      |> range(start: -8h)
      |> filter(fn: (r) => r._measurement == "accelerometer")
      |> filter(fn: (r) => r._field == "x" or r._field == "y" or r._field == "z" or r._field == "magnitude")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;
  try {
    const rows = [];
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const data = tableMeta.toObject(row);
        rows.push(data);
      },
      complete() {
        const maxMagnitudes = getMaxMagnitudePerMinute(rows);
        const jsonArray = Object.entries(maxMagnitudes).map(([key, value]) => ({
          [key]: value,
        }));
        res.json(jsonArray);
      },
      error(error) {
        console.error("Error querying data:", error);
        res.status(500).send("Error querying data");
      },
    });
  } catch (error) {
    console.error("Error querying data:", error);
    res.status(500).send("Error querying data");
  }
});

app.get("/gyroscope", async (req, res) => {
  const queryApi = client.getQueryApi(process.env.INFLUXDB_ORG);
  const query = `
    from(bucket: "wireless")
      |> range(start: -8h)
      |> filter(fn: (r) => r._measurement == "gyroscope")
      |> filter(fn: (r) => r._field == "x" or r._field == "y" or r._field == "z" or r._field == "magnitude")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;
  try {
    const rows = [];
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const data = tableMeta.toObject(row);
        rows.push(data);
      },
      complete() {
        const maxMagnitudes = getMaxMagnitudePerMinute(rows);
        const jsonArray = Object.entries(maxMagnitudes).map(([key, value]) => ({
          [key]: value,
        }));
        res.json(jsonArray);
      },
      error(error) {
        console.error("Error querying data:", error);
        res.status(500).send("Error querying data");
      },
    });
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
