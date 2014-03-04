
var express = require('express');
var byline = require('byline');
var spawn = require('child_process').spawn;
var fs = require('fs');

function RaspiCam(options)
{
	options = options || {};
	
	this.port = options.port || 4545;
	
	this.requests = [];
	
	this.width = options.width || 640;
	this.height = options.height || 480;
	this.quality = 5;	
	
	this.filename = options.filename || '/tmpfs/cam.jpg';

	this.process = null;
	
	this.timeout = null;
	
	this.server = express();
	this.server.use(express.static(__dirname + '/../static'));
	this.server.get('/data', this.get.bind(this));
}

module.exports = RaspiCam;

RaspiCam.prototype.start = function()
{
	this.server.listen(this.port);
}

RaspiCam.prototype.get = function(req,res)
{
	if(!this.process){
		this.startCapture();	
	}
	
	if(this.timeout){
		clearTimeout(this.timeout);
	}
	
	var self = this;
	this.timeout = setTimeout(function(){
		console.log('Killing sub process');
		self.process.kill('SIGKILL');
	},5000);
	
	
	this.requests.push(res);
};

RaspiCam.prototype.gotFrame = function(stream){

	for(var i=0; i < this.requests.length; i++){
		var req = this.requests[i];
		req.writeHead(200, {
			'Content-Type':'image/jpg',
		});
		
  		stream.on('data', function(data){
			req.write(data);
		});

		stream.on('end',function(){
			req.end();
		});	
	}
	
	stream.on('end',function(){
		this.requests = [];
	}.bind(this));
};

RaspiCam.prototype.startCapture = function(){
	
	var self = this;
	this.process = spawn('/usr/bin/raspistill',[
		'-v', '-n', '-s',
		'-t', 999999999,
		'-tl', 200,
		'-q', this.quality,
		'-o', this.filename,
		'-w', this.width,
		'-h', this.height
	]);
	
	var out = byline(this.process.stderr);
	out.on('data', function(line){
		console.log('RASPISTILL: ' + line);
		
		if(line.toString().indexOf('Finished capture') === 0){
			
			var stream = fs.createReadStream(self.filename);
			console.log('Frame captured');
			self.gotFrame(stream);
		}
		
	});
	
	this.process.on('close', function(){
		self.process = null;
	});
};
