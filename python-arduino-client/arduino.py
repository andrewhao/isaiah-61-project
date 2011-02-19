import socket
import firmata
import time
import threading


lowerBound = 60
upperBound = 255

# --------------------------------------------------------------
# Faders, etc
# --------------------------------------------------------------
curFader = None

# Fader flag acts as messaging system for active Fader object.
# setting the flag to True should effectively kill the Fader thread
stopFaderFlag = False
faderFlagLock = threading.Lock()
intentToChangeLock = threading.Lock()

faderFlag = threading.Event()


# Three pulses.
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
        threading.Thread.__init__(self)
        self.pinNum = pinNum

    def stopFader(self):
        global stopFaderFlag
        """Protects access to the fader flag."""
        print '-%s- stopping fader. val: %s' % (self.pinNum, stopFaderFlag)
        faderFlagLock.acquire()
        print '-%s- stopping fader freal: %s' % (self.pinNum, stopFaderFlag)
        stopFaderFlag = True
        print '-%s- just changed: %s' % (self.pinNum, stopFaderFlag)
        faderFlagLock.release()
        print '-%s- again, with released lock: %s' % (self.pinNum, stopFaderFlag)

    def resetFaderFlag(self):
        """
        Once a fader is stopped, we should reset it. This is called only
        from a stopping Fader.
        """
        global stopFaderFlag
        print '-%s- resetting fader' % self.pinNum
        faderFlagLock.acquire()
        stopFaderFlag = False
        faderFlagLock.release()

    def run(self):
        """
        Run the glow effect for 2 cycles and turn off.
        """
        global stopFaderFlag
        print 'running the fader on pin %s' % self.pinNum
        for i in pinIntensities:
            
            print '-%s- stopFaderFlag is %s' % (self.pinNum, stopFaderFlag)
            
            # Check the flag to see if we should exit.
            if stopFaderFlag:
                print '-%s- declared intent to stop' % self.pinNum
                self.resetFaderFlag()
                print '-%s- stopping fader on pin %s' % (self.pinNum, self.pinNum)
                print '-%s- after I stop, fader flag is %s' % (self.pinNum, stopFaderFlag)
                # one line after the return, the thread should die.
                return
            else:
                print 'nah'
                print '-%s-- stopFaderFlag is %s' % (self.pinNum, stopFaderFlag)
                a.analog_write(int(self.pinNum), i)
                time.sleep(0.003)
        print '+%s+ fader was allowed to fade out on pin %s' % (self.pinNum, self.pinNum)

# Set up the Arduino interfaces.
serial_addr = '/dev/tty.usbmodem3d11'
a = firmata.Arduino(serial_addr)
print ('Connecting to bootloader. Please wait.')
# Need 2s to make sure the connection is made with the firmware.
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
    # 
    data = s.recv(8);
#    assert data, 'No data found on socket'
    if not data:
        continue

    print 'all data recv was: %s' % data
    assert len(data) == 2, 'Only two bytes expected on socket queue.'

    pinNum = data[0]
    print 'pin to pulse is: %s' % pinNum
    
    # stop the current fader
    if curFader:
        curFader.stopFader()

    print 'before I start a new Fader, the current state of fader flag is: %s' % stopFaderFlag
    curFader = Fader(pinNum)
    curFader.daemon = True

    # Start the fader on that pin.
    curFader.start()