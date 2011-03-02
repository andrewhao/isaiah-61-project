import socket
import pyduino
import time
import threading
import Queue


lowerBound = 60
upperBound = 255

# --------------------------------------------------------------
# Faders, etc
# --------------------------------------------------------------
curFader = None

## Thread communication system for active Fader object.
# Pushing a 'True' value onto the queue should effectively kill the Fader thread.
faderMsgQueue = Queue.Queue()


## Pulse pattern. Seven or eight pulses, max.
pinIntensities = range(0, upperBound) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, lowerBound - 1, -1) + \
                range(lowerBound, upperBound + 1) + \
                range(upperBound, -1, -1)

class Fader(threading.Thread):
    def __init__(self, pinNum):
        print 'init fader with pinnum of %s' % pinNum
        threading.Thread.__init__(self, name="fader")
        self.pinNum = int(pinNum)

    def run(self):
        """
        Run the glow effect for 2 cycles and turn off.
        """
        print 'running the fader on pin %s' % self.pinNum
        for pinVal in pinIntensities:

            # Check the flag to see if we should exit.
            # FIXME Try/catch is horribly expensive.
            try:
                stopMsg = faderMsgQueue.get(False)
                print '-%s- stopping fader on pin %s' % (self.pinNum, self.pinNum)
                
                # Flicker 3 times.
                for j in range(3):
                    a.digital[self.pinNum].write(1)
                    time.sleep(0.05)
                    a.digital[self.pinNum].write(0)
                    time.sleep(0.05 )

                
                # Turn off all arrays.
                writeAllPins(0)
                faderMsgQueue.task_done()
                # Thread should die here.
                return
            except Exception:
                # No stop message, so continue the pulse animation.
                a.digital[self.pinNum].write(float(pinVal) / 255)
                # 6ms interval
                time.sleep(0.006)
        # Thread should die here.
        print '+%s+ fader was allowed to fade out on pin %s' % (self.pinNum, self.pinNum)


# Set up the Arduino interfaces.
serial_addr = '/dev/ttyACM1'
a = pyduino.Arduino(serial_addr)

# Need 2s to make sure the connection is made with the firmware.
print 'Connecting to bootloader. Please wait.'
time.sleep(5)
a.iterate()

# Pins of interest. These happen to be PWM pins on the Arduino Uno.            
PINS = [3, 5, 6, 9]

# Set PWM pin modes
for pin in PINS:
    a.digital_ports[pin >> 3].set_active(1)
    a.digital[pin].set_mode(pyduino.DIGITAL_PWM)

def writeAllPins(intensity):
    """
    Send an analog intensity signal to all pins.
    Send writeAllPins(0) to turn off all lights.
    """
    for pin in PINS:
        a.digital[pin].write(intensity);

# ----------------------------------------------
# Set up the socket interface to nodejs server.
# ----------------------------------------------
hostname = 'localhost'
port = 7000
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((hostname, port))

# Listen on socket and drain when it's time.
while True:
    
    # read 2-byte pin command at a time (pin + NULL).
    data = s.recv(2);
    
    # Keep polling.
    if not data:
        continue

    assert len(data) == 2, 'Only two bytes expected on socket queue.'

    pinNum = data[0]

    if curFader:
        # Putting a message on the queue will be consumed by the
        # Fader thread which will cause it to die.
        faderMsgQueue.put('stop', False);
        # Block until we're sure it's dead.
        faderMsgQueue.join();

    # start a new Fader
    curFader = Fader(pinNum)
    curFader.daemon = True

    # Start the fader on that pin.
    curFader.start()
