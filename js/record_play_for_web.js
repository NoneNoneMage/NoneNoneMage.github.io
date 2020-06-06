RecordPlay = function(option){
    var version = '1.0.0';
    var self = this;

    var janus = null;
    var recordHandle = null;
    var recordingId = null;

    var recording = false;
    var playing = false;

    var bandwidth = 1024 * 1024;

    var localScreenStream = null;

    var config = {
	};

    var configDefault = {
        recordServerUrl : 'wss://47.57.172.46:12443'
    };

    setOption(option);
    setDefault();

    function getOption(field) {
		if (field == undefined) {
			return {
				proxyUrl : config.proxyUrl,
				userName : config.userName,
				email : config.email
			};
		} else {
			var value = config[field];
			if (value == undefined) {
				value = configDefault[field];
			}
			return value;
		}
	} //getOption
    
    function setOption(option) {
        option = option || {};

        if (option.hasOwnProperty('proxyUrl')) {
            if (config.proxyUrl == undefined) {
                config.proxyUrl = (option.proxyUrl || '') + '';
            }
        }

        if (option.hasOwnProperty('baseUrl')) {
            if (config.baseUrl == undefined) {
                config.baseUrl = (option.baseUrl || '') + '';
            }
        }

        if (option.hasOwnProperty('userName')) {
            if (config.userName == undefined) {
                config.userName = (option.userName || '') + '';
            }
        }

        if (option.hasOwnProperty('email')) {
            if (config.email == undefined) {
                config.email = (option.email || '') + '';
            }
        }
        
    } //setOption

    function setDefault() {
		for (var key in configDefault) {
			if (config[key] == undefined) {
				config[key] = configDefault[key];
			}
		}
    } //setDefault

    function isObject(obj) {
        var type = typeof obj;
        return !!obj && (type == 'object' || type == 'function');
    }

    function isObjectLike(obj) {
        return !!obj && typeof obj == 'object';
    }
    function isFunction(obj) {
        return isObject(obj) && Object.prototype.toString.call(obj) == '[object Function]';
    }

    /**
     * 初始化sdk
     */
    function start(success,failure){
        Janus.init({
            debug:"all",
            callback:()=>{
                if(!Janus.isWebrtcSupported()) {
                    console.error("Webrtc not supported");
                    if(isFunction(failure)){
                        failure({
                            errCode:-1,
                            errMsg:"Webrtc not suppored"
                        })
                    }
                    return;
                }

                janus =new Janus(
                    {
                        server: config.recordServerUrl,
                        success:()=>{
                            janus.attach({
                                plugin: "janus.plugin.recordplay",
                                opaqueId:"recordplay-"+Janus.randomString(12),
                                success:(pluginHandle)=>{
                                    recordHandle = pluginHandle;
                                    console.log("Plugin attached! (" + recordHandle.getPlugin() + ", id=" + recordHandle.getId() + ")");
                                    if(isFunction(success)){
                                        success();
                                    }
                                },
                                error:(error)=>{
                                    if(isFunction(failure)){
                                        failure({
                                            errCode:-3,
                                            errMsg:error
                                        })
                                    }
                                    console.error(error);
                                },
                                consentDialog: (on)=>{
                                    console.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
                                },
                                webrtcState: (on) => {
									console.log("WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                                },
                                onmessage: (msg, jsep)=>{
                                    console.debug(" ::: Got a message :::");
									console.debug(msg);
                                    var result = msg["result"];
                                    if(result !== null && result !== undefined) {
                                        var event = result["status"];
                                        if(event === 'preparing' || event === 'refreshing') {
                                            Janus.log("Preparing the recording playout");
                                            recordHandle.createAnswer(
                                            {
                                                jsep: jsep,
                                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                                success: function(jsep) {
                                                    Janus.debug("Got SDP!");
                                                    Janus.debug(jsep);
                                                    var body = { "request": "start" };
                                                    recordHandle.send({"message": body, "jsep": jsep});
                                                },
                                                error: function(error) {
                                                    Janus.error("WebRTC error:", error);
                                                }
                                            });
                                            if(result["warning"])
                                                Janus.warn(result["warning"]);
                                        }else if(event === 'recording') {
                                            // Got an ANSWER to our recording OFFER
                                            if(jsep !== null && jsep !== undefined)
                                                recordHandle.handleRemoteJsep({jsep: jsep});
                                            var id = result["id"];
                                            if(id !== null && id !== undefined) {
                                                Janus.log("The ID of the current recording is " + id);
                                                recordingId = id;
                                                self.recordBegin(recordingId);
                                            }
                                        }else if(event === 'slow_link') {
                                            var uplink = result["uplink"];
                                            if(uplink !== 0) {
                                                // Janus detected issues when receiving our media, let's slow down
                                                bandwidth = parseInt(bandwidth / 1.5);
                                                recordHandle.send({
                                                    'message': {
                                                        'request': 'configure',
                                                        'video-bitrate-max': bandwidth, // Reduce the bitrate
                                                        'video-keyframe-interval': 15000 // Keep the 15 seconds key frame interval
                                                    }
                                                });
                                            }
                                        }else if(event === 'playing') {
                                            Janus.log("Playout has started!");
                                            self.playBegin();
                                        }else if(event === 'stopped') {
                                            Janus.log("Session has stopped!");
                                            var id = result["id"];
                                            if(recordingId !== null && recordingId !== undefined) {
                                                if(recordingId !== id) {
                                                    Janus.warn("Not a stop to our recording?");
                                                    return;
                                                }
                                                console.log("Recording completed! Check the list of recordings to replay it.");
                                            }
                                            // recording = false;
                                            // playing = false;
                                            recordingId = null;
                                            recordHandle.hangup();
                                            localScreenStream = null;
                                    
                                        }
                                    }else{
                                        var error = msg["error"];
										Janus.warn(error);
                                        recordingId = null;
                                        // recording = false;
                                        // playing = false;
                                        recordHandle.hangup();
                                        localScreenStream = null;
                                    }
                                },
                                onlocalstream:(stream)=>{
                                    localScreenStream = stream;
                                    Janus.attachMediaStream($('#localStream').get(0), stream);
                                    localScreenStream.addEventListener('inactive', e => {
                                        console.log('Capture stream inactive - stop recording!');
                                        if(recording){
                                            stop()
                                        }
                                      });
                                    const track = localScreenStream.getVideoTracks()[0];
                                    if(track != undefined){
                                        track.onended = function(){
                                            console.log("Video tracks ended")
                                            if(recording){
                                                stop();
                                            }
                                        }
                                    }
                                    $("#localStream").get(0).muted = "muted";
                                },
                                onremotestream:(stream)=>{
                                    Janus.attachMediaStream($('#recordPlayVideo').get(0), stream);
                                },
                                oncleanup:()=>{
                                    localScreenStream = null;
                                    Janus.log(" ::: Got a cleanup notification :::");
                                    if(playing){
                                        playing = false;
                                        self.playEnd();
                                    }
                                    if(recording){
                                        recording = false;
                                        self.recordEnd();
                                    }
                                }
                            })

                        }, //new Janus success
                        error:(error)=>{
                            if(isFunction(failure)){
                                failure({
                                    errCode:-2,
                                    errMsg:error
                                })
                            }
                            console.error(error);
                        },
                        destroyed:()=>{
                            console.log("client has been destroyed");
                        }
                    }
                ) //new Janus

            } //Janus.init callback
        }); //Janus.init
    }

    function getRecsList(success,failure){
        var body = { "request": "list" };
        console.debug("Sending message (" + JSON.stringify(body) + ")");
	    recordHandle.send({"message": body, success: (result) => {
        
                if(result === null || result === undefined) {
                    if(isFunction(failure)){
                        failure({
                            errCode:-1,
                            errMsg:"Got no response to our query for available recordings"
                        })
                    }
                    console.warn("Got no response to our query for available recordings");
                    return;
                }

                if(result["list"] !== undefined && result["list"] !== null) {
                    var list = result["list"];
                    list.sort(function(a, b) {return (a["date"] < b["date"]) ? 1 : ((b["date"] < a["date"]) ? -1 : 0);} );
                    console.debug("Got a list of available recordings:");
                    console.debug(list);//id name date
                    if(isFunction(success)){
                        success(list);
                    }
                }else{
                    if(isFunction(failure)){
                        failure({
                            errCode:-2,
                            errMsg:"No list in response"
                        })
                    }
                    console.log("No list in response");
                }
            } //getRecs success callback
        }); //send cmd
    } //getRecsList


    function startRecording(name) {
        if(recording)
            return;
        // Start a recording
        recording = true;
        playing = false;
       
        if(name == undefined || name == ""){
            name = "defaultName-" + Janus.randomString(12);
        } else {
            name = "record-" + name;
        }
        recordHandle.send({
            'message': {
                'request': 'configure',
                'video-bitrate-max': bandwidth, // a quarter megabit
                'video-keyframe-interval': 15000 // 15 seconds
            }
        });
    
        recordHandle.createOffer(
            {
                // By default, it's sendrecv for audio and video... no datachannels
                // If you want to test simulcasting (Chrome and Firefox only), then
                // pass a ?simulcast=true when opening this demo page: it will turn
                // the following 'simulcast' property to pass to janus.js to true
                simulcast: false,
                media: { video: "window", audioSend: true, videoRecv: false},
                success: function(jsep) {
                    Janus.debug("Got SDP!");
                    Janus.debug(jsep);
                    var body = { "request": "record", "name": name };
                    recordHandle.send({"message": body, "jsep": jsep});
                },
                error: function(error) {
                    Janus.error("WebRTC error...", error);
                    recordHandle.hangup();
                }
            });
    }
    
    function startPlayout(id) {
        if(playing)
            return;
        // Start a playout
        recording = false;
        playing = true;
        if(id === undefined || id === null) {
            playing = false;
            return;
        }
        var play = { "request": "play", "id": parseInt(id) };
        recordHandle.send({"message": play});
    }
    
    function stop() {
        var stop = { "request": "stop" };
        recordHandle.send({"message": stop});
        recordHandle.hangup();
        localScreenStream = null;
    }

    this.start = function(success,failure){
        return start(success,failure);
    }

    this.startRecording = function(name){
        return startRecording(name);
    }

    this.startPlaying = function(id){
        return startPlayout(id);
    }

    this.stopRecordOrPlay = function(){
        return stop();
    }

    this.getRecordsList = function(success,failure){
        return getRecsList(success,failure);
    }

    this.playEnd = function(){
        window.location.href = "conf.html";
    }

    this.recordEnd = function(){
        console.log("record end");
    }

    this.playBegin = function(){
        console.log("play begin");
    }

    this.recordBegin = function(recordId){
        console.log("record begin : "+ recordId);
    }

    this.recording = function() {
        return recording;
    };

}