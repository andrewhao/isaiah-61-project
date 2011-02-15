import socket
import firmata

# Set up the Arduino interfaces.
serial_addr = '/dev/tty.usbmodem3d11'
a = firmata.Arduino(serial_addr)
#a.pin_mode(10, firmata.PWM)
#a.pin_mode(9, firmata.PWM)
a.pin_mode(11, firmata.PWM)
print ('Connecting to bootloader. Please wait.')
a.delay(2)

# Set up the socket interface to nodejs server.
hostname = 'localhost'
port = 7000
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((hostname, port))

cur_pin = 13
# Listen on socket and drain when it's time.
#
# HACK! A single driver loop both controls the fade function on the LED pin,
# and drains the socket and switches pinouts.
while True:
    # read 2-byte pin command at a time (pin + NULL).
    data = s.recv(3);
    if data:
        print 'pin to pulse is: %s' % data[0:-1]
        a.analog_write(cur_pin, 0)
        cur_pin = int(data[0:-1])
        a.analog_write(cur_pin, 254)
    else:
        print 'no data recv'