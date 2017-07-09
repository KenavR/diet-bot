/*jshint esversion: 6 */

var Discord = require('discord.io');
var fs = require('fs');
var path = require('path');
var request = require('request');
var http = require('http');
var https = require('https');
var googleTTS = require('google-tts-api');
var urlParse	= require('url').parse;
var latestTweets = require('latest-tweets');

var bot = new Discord.Client({
	autorun: true,
	token: "Mjc5ODc5Mzk4MzIzMjU3MzQ2.C4BW3Q.uzwb7aUX467ifmjRh_ZYoXQ9fJM"
});

// Pretty ASCII boot screen
fs.readFile('dietbot-ascii.txt', 'utf8', function(err, data) {console.log(data);});

// Init Command Queue Object
var cQ = {
	queue: [],
	ready: true,
	commandMap: [],
	addCommand: function(array, method) {
		if (typeof array === 'object') {
			for(i=0; i<array.length; i++) {
				this.commandMap[array[i]] = method;
			}
		} else {
			this.commandMap[array] = method;
		}
	}
};

bot.on('ready', function(event) {
	//log that you're in
	console.log('Logged in as %s - %s\n', bot.username, bot.id);

	//find all users
	userList = Object.keys(bot.users);

	//find all the channels
	channelList = Object.keys(bot.channels);

	this.setPresence({
		game:{
			name:"Bigly Wigly"
		}
	});

	cQ.addCommand('!help','doHelpInfo');
	cQ.addCommand(['!b','!buttlord'],'doButtlord');
	cQ.addCommand(['!a','!airhorn','!audio'],'doAirhorn');
	cQ.addCommand(['!s','!say'],'doSay');
	cQ.addCommand(['!j','!join'],'doJoinChannel');
	cQ.addCommand(['!k','!kick'],'doLeaveChannel');
	cQ.addCommand(['!i','!insult'],'doInsult');
	cQ.addCommand(['!r','!rave'],'doRave');
	cQ.addCommand(['!t','!trump'],'doTrump');
	cQ.addCommand(['!tt','!trumptweet'], 'doTrumpTweet');
});

var cqInterval = null;

// Temp sniffer for voicestate events
bot.on('any', function(event) {
	if (event.t === 'VOICE_STATE_UPDATE' && event.d.channel_id !== null) {
		console.log(event)
		console.log(event.d.user_id);
	}
});


bot.on('message', function(user, userID, channelID, message, event) {
	cQ.queue.push({user, userID, channelID, message, event});
	checkQueue();
});

function checkQueue() {
	console.log('Checking Queue. Current size: %d', cQ.queue.length);
	// If Queue is not empty
	if (cQ.queue.length > 0) {
		if(cqInterval == null) {
			cqInterval = setInterval(checkQueue, 500);
		}

		if (cQ.ready) {
			extractFromQueue (cQ.queue[0]);
			cQ.queue.shift();
		}
	} else {
		clearInterval(cqInterval);
		cqInterval = null;
	}
}

function extractFromQueue(queueItem) {
	var user = queueItem.user;
	var userID = queueItem.userID;
	var channelID = queueItem.channelID;
	var message = queueItem.message;
	var event = queueItem.event;
	var voiceChannelID = findUserChannel(userID, channelList);

	var functions = BotFunctions();

	var command = parseCommand(message);
	if(command != null && command.length > 0) {
		try {
			if(functions[cQ.commandMap[command[0]]] !== undefined) {
				functions[cQ.commandMap[command[0]]](user, userID, channelID, voiceChannelID, message, event, command, cQ);
			} else {
				functions.doBotType(channelID, "That is not a valid command.")
			}
		} catch (e) {
			console.log("Error finding function associated to command %s. \n%s ", command[0], e);
		}
	}
}

function findUserChannel(userID, channelList) {
	for(i = 0; i < channelList.length; i++) {
		if (bot.channels[channelList[i]].members[userID] !== undefined) {
			return bot.channels[channelList[i]].members[userID].channel_id;
		}
	}
}

function findUserId(username, array) {
	var usernameToSearch = username.toLowerCase();
	for(i = 0; i < array.length; i++) {
		 if(bot.users[array[i]].username.toLowerCase().startsWith(usernameToSearch)) {
				 return [bot.users[array[i]].id, bot.users[array[i]].username];
		 }
	}
	return [];
}

function parseCommand(string) {
	if (string.substring(0,1) === "!") {
		//split on space
		string = string.split(" ");

		var c = 0; //counts how many array items there are
		var theArray = []; //the output array

		for (i = 0; i < string.length; i++) {
			// if has !, put into own array
			if (string[i].substring(0,1) === "!") {
				theArray[c++] = string[i];
			} else {
				//if undefined, make string
				if(theArray[c] === undefined) {
					theArray[c++] = string[i];
				} else {
					theArray[c++] += " " + string[i];
				}
				//rebuild string
			}
		}
		return(theArray);
	}
}

function downloadFile (url, dest) {
	return new Promise((resolve, reject) => {
		const info = urlParse(url);
		const httpClient = info.protocol === 'https:' ? https : http;
		const options = {
			host: info.host,
			path: info.path,
			headers: {
				'user-agent': 'Windows NT 6.2; WOW64; rv:19.0) Gecko/20100101 Firefox/19.0'
			}
		};

		httpClient.get(options, function(res) {
			// check status code
			if (res.statusCode !== 200) {
				reject(new Error(`request to ${url} failed, status code = ${res.statusCode} (${res.statusMessage})`));
				return;
			}

			const file = fs.createWriteStream(dest);
			file.on('finish', function() {
				// close() is async, call resolve after close completes.
				file.close(resolve);
			});
			file.on('error', function (err) {
				// Delete the file async. (But we don't check the result)
				fs.unlink(dest);
				reject(err);
			});

			res.pipe(file);
		})
		.on('error', function(err) {
			reject(err);
		})
		.end();
	});
}

function includeGetWrecked(){
		var randomInt = Math.floor(Math.random()*9);
	if(randomInt == 8) {
			return ". Get wrecked.";
	} else {
			return "";
	}
}

var BotUtil = function () {
	var listOfFunctions = {};
	listOfFunctions.joinChannelPlayAudioAndLeave = function(voiceChannel, audioFileLocation, cQ) {
		cQ.ready = false;
		fs.stat(audioFileLocation, function(err, stat) {
			if (err == null) {
			//Let's join the voice channel, the ID is whatever your voice channel's ID is.
			bot.joinVoiceChannel(voiceChannel, function(error, events) {
				//Check to see if any errors happen while joining.
				if (error) {
					bot.leaveVoiceChannel(voiceChannel);
					setTimeout(function(){cQ.ready = true;},750);
					return console.error(error);
				}

				console.log('Bot Joined the Voice Channel %s', voiceChannel);

				//Then get the audio context
				bot.getAudioContext(voiceChannel, function(error, stream) {
					//Once again, check to see if any errors exist
					if (error) {
						bot.leaveVoiceChannel(voiceChannel);
						setTimeout(function(){cQ.ready = true;},750);
						return console.error(error);
					}

					fs.createReadStream(audioFileLocation).pipe(stream, {end: false});

					//The stream fires `done` when it's got nothing else to send to Discord.
					stream.on('done', function() {
						bot.leaveVoiceChannel(voiceChannel);
						setTimeout(function(){cQ.ready = true;},750);
						console.log('Bot Left the Voice Channel');
					});
				});
			});
			} else if(err.code == 'ENOENT') {
				setTimeout(function(){cQ.ready = true;},750);
			}
		});
	};

	listOfFunctions.speakToStream = function(text, stream, voiceChannel, soundToPlayFollowingText) {
		var fileName = "audio/" + new Date().getTime() + ".mp3";	// Generate a unique file name
		var dest = path.resolve(__dirname, fileName); // file destination

		googleTTS(text, 'En-gb', 0.9)	 // speed normal = 1 (default), slow = 0.24. Create the URL via Google TTS API
		.then(function (url) {
			// Download the file, but wait 500 milliseconds before executing the voice stream to ensure the file is written (flaky but it works for now)
			downloadFile(url, dest);
			setTimeout(function() {
				fs.createReadStream(fileName).pipe(stream, {end: false});
				if(soundToPlayFollowingText != null) {
				fs.createReadStream(soundToPlayFollowingText).pipe(stream, {end: false});
				}
			}, 500);
		})
		.catch(function (err) {
			console.error(err.stack);
		});
		return fileName;
	};

	listOfFunctions.joinChannelAndSay = function(voiceChannel, text, soundToPlayFollowingText, cQ) {
		if(voiceChannel !== undefined) {
			cQ.ready = false;
			//Let's join the voice channel, the ID is whatever your voice channel's ID is.
			bot.joinVoiceChannel(voiceChannel, function(error, events) {
				//Check to see if any errors happen while joining.
				if (error) {
					bot.leaveVoiceChannel(voiceChannel);
					setTimeout(function() {cQ.ready=true;},100);
					return console.error(error);
				}

				//Then get the audio context
				bot.getAudioContext(voiceChannel, function(error, stream) {
					//Once again, check to see if any errors exist
					if (error) {
						bot.leaveVoiceChannel(voiceChannel, checkQueue);
						return console.error(error);
					}

					if(text.length <= 12) {
						text = "You haven't given me enough to say.";
					}

					var audioFileName = listOfFunctions.speakToStream(text, stream, voiceChannel, soundToPlayFollowingText);

					//The stream fires `done` when it's got nothing else to send to Discord.
					stream.on('done', function() {
						bot.leaveVoiceChannel(voiceChannel, checkQueue);
						setTimeout(function() {cQ.ready=true;},100);

						// Delete the file after 1 second
						setTimeout(function() {
						try {
							fs.unlinkSync(audioFileName);
						}catch (e) {/* For some reason an error throws after a file deletes, ignore it */ }
						}, 1000);
					});
				});
			});
		}
	};
	return listOfFunctions;
};

var BotFunctions = function () {
	var util = BotUtil();
	var listOfFunctions = {};

	// Do Buttlord
	listOfFunctions.doButtlord = function(user, userID, channelID, voiceChannelID, message, event, command, cQ) {
		var randomInt = Math.floor(Math.random()*9);
		if(randomInt >= 8) {
		} else {
			util.joinChannelPlayAudioAndLeave(voiceChannelID, 'audio/buttlord.mp3', cQ);
		}
	};

	// Do Airhorn
	listOfFunctions.doAirhorn = function(user, userID, channelID, voiceChannelID, message, event, command, cQ) {
		filePath = "audio/airhorn" + ((command[1] !== undefined)? "-" + command[1] : "") + ".mp3";
		util.joinChannelPlayAudioAndLeave(voiceChannelID, filePath, cQ);
	};

	// Do Say
	listOfFunctions.doSay = function(user, userID, channelID, voiceChannelID, message, event, command, cQ) {
		var whatToSay = "";
		for(var i=1; i<command.length; i++) {
			whatToSay+=command[i] + " ";
		}
		util.joinChannelAndSay(voiceChannelID, whatToSay, null, cQ);
	};

	// Join Channel and Insult (private, only used by BotFunctions)
	listOfFunctions.joinChannelInsult = function(username, voiceChannelID, cQ) {
		console.log("Attempting to insult %s",  username);
		if(username === "Awod") {
			username = "eh whod";
		}

		var sayInsult = true;

		if(username === "catcherfreeman") {
			var result = Math.floor(Math.random()*9);
			// give a complement 10% of the time
			if(result === 0) {
					sayInsult = false;
			}
		}

		var prefixText = username + ", you are a ";
		var selectedCombo = Math.floor(Math.random()*(sayInsult ? 4 : 2));

		if(sayInsult) {
			var insult;
			switch(selectedCombo) {
				case 0:
				insult = prefixText + insultA[Math.floor(Math.random()*insultA.length)] + " " + insultB[Math.floor(Math.random()*insultB.length)] + " " + insultC[Math.floor(Math.random()*insultC.length)] + " " + includeGetWrecked();
				break;
				case 1:
				insult = prefixText + insultA[Math.floor(Math.random()*insultA.length)] + " " + insultB[Math.floor(Math.random()*insultB.length)] + " " + insultD[Math.floor(Math.random()*insultD.length)] + " " + includeGetWrecked();
				break;
				case 2:
				insult = prefixText + insultA[Math.floor(Math.random()*insultA.length)] + " " + insultB[Math.floor(Math.random()*insultB.length)] + " " + includeGetWrecked();
				break;
				case 3:
				insult = prefixText + insultB[Math.floor(Math.random()*insultB.length)] + " " + insultD[Math.floor(Math.random()*insultD.length)] + " " + includeGetWrecked();
				break;
				default:
				break;
			}
			util.joinChannelAndSay(voiceChannelID, insult, null, cQ);
		} else {
			var complement;
			switch(selectedCombo) {
				case 0:
				complement = prefixText + complementA[Math.floor(Math.random()*complementA.length)] + " " + complementB[Math.floor(Math.random()*complementB.length)] + " " + complementC[Math.floor(Math.random()*complementC.length)] + " " + includeGetWrecked();
				break;
			case 1:
				complement = prefixText + complementA[Math.floor(Math.random()*complementA.length)] + " " + complementC[Math.floor(Math.random()*complementC.length)] + " " + includeGetWrecked();
				break;
			default:
				break;
			}
			util.joinChannelAndSay(voiceChannelID, complement, null, cQ);
		}
	};

	// Do Insult
	listOfFunctions.doInsult = function(user, userID, channelID, voiceChannelID, message, event, command, cQ) {
		var username = command[1];
		var userData = findUserId(username, userList);
		if(userData != null && userData.length > 0) {
			var userToInsultVoiceChannelId = findUserChannel(userData[0], channelList);
			listOfFunctions.joinChannelInsult(userData[1], userToInsultVoiceChannelId, cQ);
		} else {
			console.log("Could not find user %s ", username);
		}
	};

	// Do Join Channel
	listOfFunctions.doJoinChannel = function(user, userID, channelID, voiceChannelID, message, event, command, cQ) {
		bot.joinVoiceChannel(voiceChannelID);
	};

	// Do leave Channel
	listOfFunctions.doLeaveChannel = function(user, userID, channelID, voiceChannelID, message, event, command, cQ) {
		bot.leaveVoiceChannel(voiceChannelID);
	};

	// Do Bot Type
	listOfFunctions.doBotType = function(channelID, messageToType) {
		bot.sendMessage({
			to: channelID,
			message: messageToType
		});
	};

	return listOfFunctions;
};


var complementA = 'beautiful,lovely,hard-working,wonderful,voluptuous'.split(',');
var complementB = 'life-giving,flower-like,'.split(',');
var complementC = 'person,angel,individual'.split(',');

var insultA = 'tossing,bloody,shitting,wanking,frothy,stinky,raging,dementing,dumb,fucking,dipping,holy,maiming,cocking,ranting,hairy,girthy,spunking,flipping,slapping,one-direction loving,trump loving,sodding,blooming,frigging,guzzling,glistering,cock wielding,failed,artist formally known as,unborn,pulsating,naked,throbbing,lonely,failed,stale,spastic,senile,strangely shaped,virgin,bottled,twin-headed,fat,gigantic,sticky,prodigal,bald,bearded,horse-loving,spotty,spitting,dandy,fritzl-admiring,friend of a,indeterminable,overrated,fingerlicking,diaper-wearing,leg-humping,gold-digging,mong loving,trout-faced,cunt rotting,flip-flopping,rotting,inbred,badly drawn,undead,annoying,whoring,leaking,dripping,racist,slutty,cross-eyed,irrelevant,mental,rotating,scurvy looking,rambling,gag sacking,cunting,wrinkled old,dried out,sodding,funky,silly,unhuman,bloated,wanktastic,bum-banging,cockmunching,animal-fondling,stillborn,scruffy-looking,hard-rubbing,rectal,glorious,eye-less,constipated,bastardized,utter,hitler\'s personal,irredeemable,complete,enormous,go suck a,fuckfaced,broadfaced,titless,son of a,demonizing,pigfaced,treacherous,retarded'.split(',');
var insultB = 'cock,tit,cunt,wank,piss,crap,shit,ass,sperm,nipple,anus,colon,shaft,dick,poop,semen,slut,suck,earwax,fart,scrotum,cock-tip,tea-bag,jizz,cockstorm,bunghole,food trough,bum,butt,shitface,ass,nut,ginger,llama,tramp,fudge,vomit,cum,lard,puke,sphincter,nerf,turd,cocksplurt,cockthistle,dickwhistle,gloryhole,gaylord,spazz,nutsack,fuck,spunk,shitshark,shithawk,fuckwit,dipstick,asswad,chesticle,clusterfuck,douchewaffle,retard'.split(',');
var insultC = 'force,bottom,hole,goatse,testicle,balls,bucket,biscuit,stain,boy,flaps,erection,mange,brony,weeaboo,twat,twunt,mong,spack,diarrhea,sod,excrement,faggot,pirate,asswipe,sock,sack,barrel,thunder cunt,head,zombie,alien,minge,candle,torch,pipe,bint,jockey,udder,pig,dog,cockroach,worm,MILF,sample,infidel,spunk-bubble,stack,handle,badger,wagon,bandit,lord,bogle,bollock,tranny,knob,nugget,king,hole,kid,trailer,lorry,whale,rag,foot'.split(',');
var insultD = 'licker,raper,lover,shiner,blender,fucker,assjacker,butler,turd-burglar,packer,rider,wanker,sucker,wiper,experiment,wiper,bender,dictator,basher,piper,slapper,fondler,bastard,handler,herder,fan,amputee,extractor,professor,graduate'.split(',');
