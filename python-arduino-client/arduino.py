import socket
import firmata
import time
import threading

class FaderController():
    """Manages Fader threads"""
    def fade(self, pinNum):
        pass

lowerBound = 60
upperBound = 255

# Three pulses.
pinIntensities = range(0, upperBound) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, -1, -1)


class Fader(threading.Thread):
    def __init__(self, pinNum):
        print 'init fader with pinnum of %s' % pinNum
        threading.Thread.__init__(self)
        self.pinNum = pinNum

    def run(self):
        """
        Run the glow effect for 2 cycles and turn off.
        """
        for i in pinIntensities:
            a.analog_write(int(self.pinNum), i)
            time.sleep(0.003)
        

# Set up the Arduino interfaces.
serial_addr = '/dev/tty.usbmodem3d11'
a = firmata.Arduino(serial_addr)
a.pin_mode(3, firmata.PWM)
print ('Connecting to bootloader. Please wait.')
a.delay(2)

# Set up the socket interface to nodejs server.
hostname = 'localhost'
port = 7000
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((hostname, port))

# Listen on socket and drain when it's time.
#
# HACK! A single driver loop both controls the fade function on the LED pin,
# and drains the socket and switches pinouts.
while True:
    # read 2-byte pin command at a time (pin + NULL).
    data = s.recv(8);
    if data:
        print 'all data recv was: %s' % data
        pinNum = data[0]
        print 'pin to pulse is: %s' % pinNum
        f = Fader(pinNum)
        f.start()
#        a.analog_write(cur_pin, 0)
#        cur_pin = int(data[0:-1])
#        a.analog_write(cur_pin, 254)
    else:
        print 'no data recv'