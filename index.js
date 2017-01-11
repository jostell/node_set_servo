var express = require('express');
var serialport = require('serialport');

var app = express();
var expressWs = require('express-ws')(app);

var port;
var portname = 'COM3'; // change to where arduino is connected
var latest_data = 5;

// not sure this is strictly necessary here
/*
app.get('/', function(req, res, next) {
	console.log('get route');
	res.end();
});
*/

// http://stackoverflow.com/questions/18310394/no-access-control-allow-origin-node-apache-port-issue
app.use(function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', 'null'); // why null ????
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	next();
});

app.get('/position', function(req, res, next){
	var msg = {
		position: latest_data
	};
	var str = JSON.stringify(msg);
	console.log("sending position " + str);
	res.send(str);
});

// not necessary:
app.ws('/', function(ws, req) {
	ws.on('message', function(msg) {
		console.log("received message: " + msg);
		contents = JSON.parse(msg);
		degrees = parseInt(contents["set_position"]);
		set_servo(degrees);
	});
});

function set_servo(degrees)
{
	if (port != null && port.isOpen())
	{
		console.log("Setting servo position " + degrees)
		port.write(degrees.toString() + '\n');
	}
	else
	{
		console.log("cannot set servo position");
	}
}


function keep_serialport_open()
{
	if (port != null && port.isOpen())
		return;
	
	console.log("trying to open serial port " + portname);
	try
	{
		port = new serialport.SerialPort(portname, {
			baudRate: 9600,
			dataBits: 8,
			parity: 'none',
			stopBits: 1,
			flowControl: false,
			parser: serialport.parsers.readline('\n'),
			autoOpen: false
		});
		port.open(function(err) {
			if (err) {
				console.log("failed to open serial port " + portname);
			} else {
				console.log("serial port " + portname + " open");

				// todo: never seems to get triggered (same with 'close' and 'error')
				//port.on('disconnected', function() {
				//	console.log("serial port disconnected");
				//});
						
				port.on('data', function(input) {
					console.log("received serial data: " + input);
					latest_data = parseInt(input);
					var msg = {
						position: latest_data
					};
					var str = JSON.stringify(msg);
					console.log("Sending servo pos: " + str);
					
					expressWs.getWss().clients.forEach(function(client) {
						client.send(str);
					});
				});
				
				set_servo(latest_data);
			}
		});
	}
	catch (e)
	{
		console.log("failed to open serial port: " + e);
	}
};

keep_serialport_open();
setInterval(keep_serialport_open, 5000);
app.listen(3000);

