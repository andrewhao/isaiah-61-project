import socket
import firmata
import time
import threading
import Queue


lowerBound = 60
upperBound = 255

# --------------------------------------------------------------
# Faders, etc
# --------------------------------------------------------------
curFader = None

# Fader flag acts as messaging system for active Fader object.
# setting the flag to True should effectively kill the Fader thread
faderMsgQueue = Queue.Queue()


## Pulse pattern. Seven or eight pulses, max
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
        self.pinNum = pinNum

    def run(self):
        """
        Run the glow effect for 2 cycles and turn off.
        """
        print 'running the fader on pin %s' % self.pinNum
        for i in pinIntensities:
            
            # Check the flag to see if we should exit.
            # FIXME Try/catch is horribly expensive.
            try:
                stopMsg = faderMsgQueue.get_nowait()
                print '-%s- stopping fader on pin %s' % (self.pinNum, self.pinNum)
                
                # Flicker.
                for i in range(2):
                    a.analog_write(int(self.pinNum), 255)
                    time.sleep(0.05)
                    a.analog_write(int(self.pinNum), 0)
                    time.sleep(0.05 )
                
                
                # Turn off all arrays.
                writeAllPins(0)
                faderMsgQueue.task_done()
                # Thread should die here.
                return
            except Exception:
                # No stop message, so continue the pulse animation.
                a.analog_write(int(self.pinNum), i)
                # 60ms interval
                time.sleep(0.006)
        # Thread should die here.
        print '+%s+ fader was allowed to fade out on pin %s' % (self.pinNum, self.pinNum)


# Set up the Arduino interfaces.
serial_addr = '/dev/tty.usbmodem3d11'
a = firmata.Arduino(serial_addr)
print ('Connecting to bootloader. Please wait.')
# Need 2s to make sure the connection is made with the firmware.
a.delay(2)

# Pins of interest. These happen to be PWM pins on the Arduino Uno.                
PINS = [3, 5, 6, 9]

def writeAllPins(intensity):
    """
    Send an analog intensity signal to all pins.
    Send writeAllPins(0) to turn off all lights.
    """
    for pin in PINS:
        a.analog_write(pin, intensity);
        

# Set up the socket interface to nodejs server.
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
    print 'currently pulsing pin %s.' % pinNum

    if curFader:
        # Putting a message on the queue will be consumed by the
        # Fader thread which will cause it to die.
        faderMsgQueue.put('stop');
        # Block until we're sure it's dead.
        faderMsgQueue.join();

    # start a new Fader
    curFader = Fader(pinNum)
    curFader.daemon = True

    # Start the fader on that pin.
    curFader.start()
