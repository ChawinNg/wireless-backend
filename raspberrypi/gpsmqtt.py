import board
import serial
import adafruit_gps
import paho.mqtt.client as mqtt

# MQTT configuration
MQTT_BROKER = ""
MQTT_PORT = 8883
MQTT_TOPIC = "gps"
MQTT_USERNAME = ""
MQTT_PASSWORD = ""

# Initialize MQTT client
client = mqtt.Client()

# Set username and password for MQTT
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Connect to MQTT Broker
client.tls_set()  # Enable SSL/TLS
client.connect(MQTT_BROKER, MQTT_PORT, 60)

# Start the MQTT loop in a separate thread
# client.loop_start()

# Create a serial connection for the GPS
uart = serial.Serial("/dev/serial0", baudrate=9600, timeout=10)

# Create a GPS module instance.
gps = adafruit_gps.GPS(uart, debug=False)  # Use UART/pyserial

# GPS settings
gps.send_command(b"PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0")
gps.send_command(b"PMTK220,1000")  # 1 Hz update rate

# MQTT Publish function
def publish_gps_data():
    if gps.has_fix:
        gps_data = {
            "isSuccess": "true",
            "timestamp": "{}/{}/{} {:02}:{:02}:{:02}".format(
                gps.timestamp_utc.tm_mon,
                gps.timestamp_utc.tm_mday,
                gps.timestamp_utc.tm_year,
                gps.timestamp_utc.tm_hour,
                gps.timestamp_utc.tm_min,
                gps.timestamp_utc.tm_sec,
            ),
            "latitude": gps.latitude,
            "longitude": gps.longitude,
            "altitude": gps.altitude_m,
            "speed_knots": gps.speed_knots,
            "satellites": gps.satellites,
        }
        # Publish the data to the MQTT topic
        client.publish(MQTT_TOPIC, str(gps_data))
        print("Published GPS data to MQTT:", gps_data)
    else:
        client.publish(MQTT_TOPIC, str({"isSuccess": "false"}))
        print("Waiting for fix...")

# Main loop
last_print = time.monotonic()
while True:
    # Update GPS data
    gps.update()

    # Publish data every second if there's a fix
    current = time.monotonic()
    if current - last_print >= 1.0:
        last_print = current
        publish_gps_data()

    # Keep the MQTT client loop running to handle reconnections, etc.
    client.loop()