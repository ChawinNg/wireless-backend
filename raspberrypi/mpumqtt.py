import paho.mqtt.client as mqtt
import mpu6050
import time

# MQTT configuration
MQTT_BROKER = ""
MQTT_PORT = 8883
MQTT_TOPIC = "mpu"
MQTT_USERNAME = ""
MQTT_PASSWORD = ""

# Create a new Mpu6050 object
mpu6050 = mpu6050.mpu6050(0x68)

# MQTT callbacks
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT Broker!")
    else:
        print(f"Failed to connect, return code {rc}")

def on_publish(client, userdata, mid):
    print(f"Message published: {mid}")

# Initialize MQTT client
client = mqtt.Client()

# Set username and password for MQTT
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

# Set up callbacks
client.on_connect = on_connect
client.on_publish = on_publish

# Connect to the MQTT broker
client.tls_set()  # Enable SSL/TLS
client.connect(MQTT_BROKER, MQTT_PORT, 60)

# Start the MQTT loop in a separate thread
client.loop_start()

# Define a function to read the sensor data
def read_sensor_data():
    # Read the accelerometer values
    accelerometer_data = mpu6050.get_accel_data()

    # Read the gyroscope values
    gyroscope_data = mpu6050.get_gyro_data()

    # Read temp
    temperature = mpu6050.get_temp()

    # Return the sensor data as a dictionary
    return {
        "accelerometer": accelerometer_data,
        "gyroscope": gyroscope_data,
        "temperature": temperature
    }

# Start a while loop to continuously read and publish the sensor data
try:
    while True:
        # Read the sensor data
        sensor_data = read_sensor_data()

        # Format the sensor data as a string (JSON-like structure for simplicity)
        message = {
            "accelerometer" : sensor_data['accelerometer'],
            "gyroscope" : sensor_data['gyroscope'],
            "temperature" : "{:.2f}°C".format(sensor_data['temperature'])
        }

        # Publish sensor data to the MQTT topic
        result = client.publish(MQTT_TOPIC, str(message))

        # Print the message for debugging
        print("Published message:", message)

        # Wait for 1 second before sending the next reading
        time.sleep(1)

except KeyboardInterrupt:
    print("Stopping the MQTT client...")
finally:
    client.loop_stop()
    client.disconnect()