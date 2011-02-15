import socket
import firmata

hostname = 'localhost'
port = 7000
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((hostname, port))

while True:
    # read 2 bytes at a time, because thats all we expect per pin command.
    data = s.recv(2);
    if data:
        print 'data is: %s' % data
    else:
        print 'no data recv'
