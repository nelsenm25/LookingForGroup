
// Import necessary modules
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config.js');
const fs = require('fs');
require('dotenv').config();

// Create a new client instance
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const version = "0.1";
var timerInterval;
var channelActivityInterval;
var sudoMode = [];

// Function to log errors
function logError(ERROR, ERROR_CONTENT, GUILD_ID) {
    fs.appendFileSync("log.txt", "\r\n***ERROR***\r\n");
    fs.appendFileSync("log.txt", "Guild ID: " + GUILD_ID + "\r\n");
    fs.appendFileSync("log.txt", "Friendly error message: " + ERROR + "\r\n");
    fs.appendFileSync("log.txt", "Technical info: " + ERROR_CONTENT + "\r\n");

    console.log("ERROR: " + ERROR);
}

// Function to set options
function setOption(MESSAGE) {
    if (MESSAGE.guild.ownerId !== MESSAGE.author.id) {
        return;
    }
    var PARAMS = MESSAGE.content.split(' ').slice(1);
    if (PARAMS.length != 2) {
        MESSAGE.reply('Sorry that didn\'t work. Did you type the command like this: !lfgset <SETTING> <VALUE>');
        return;
    }
    config.setSetting(PARAMS[0], MESSAGE.guild.id, PARAMS[1]).then(RESULT => {
        MESSAGE.reply(`Success.\n Changed **${PARAMS[0]}** to **${PARAMS[1]}**.`);
    }).catch(err => {
        if (err == "NONEXISTANT") {
            MESSAGE.reply('The setting you tried to change does not exist.');
        } else {
            MESSAGE.reply(`Error.\n **${PARAMS[0]}** could not be added.`);
            if (err != false) {
                MESSAGE.reply(err);
            }
        }
    });
}

// Function to add a game
function addGame(MESSAGE) {
    if (!MESSAGE.member.permissions.has("ADMINISTRATOR")) {
        return;
    }
    var PARAMS = MESSAGE.content.split(' ').slice(1);
    if (PARAMS.length <= 1 || PARAMS[0].match(/[^0-9]/)) {
        MESSAGE.reply('Sorry that didn\'t work. Did you type the command like this: !lfgadd <MAX PLAYERS> <GAME>');
        return;
    }
    var LIMIT = PARAMS[0];
    if (LIMIT >= 99) {
        MESSAGE.reply('Sorry, due to Discord limitations max players need to be less than 99.');
        return;
    }
    if (LIMIT < 2) {
        MESSAGE.reply('Groups must have at least two people in them.');
        return;
    }
    var GAME = PARAMS[1];
    for (var i = 2; i < PARAMS.length; i++) {
        GAME += '-' + PARAMS[i];
    }
    if (GAME.match(/[^a-zA-Z0-9_\-\s]/)) {
        MESSAGE.reply('Sorry, due to Discord limitations game names must be alphanumerical. Names can also contain dashes/underscores.');
        return;
    }
    config.addGame(MESSAGE.guild.id, GAME, LIMIT).then(RESULT => {
        MESSAGE.reply(`Success.\n Added **${GAME}** (max. **${LIMIT} players**) to the verified games list.`);
    }).catch(err => {
        logError(`Failed to add game "${GAME}" to the games list.`, err, MESSAGE.guild.id);
        MESSAGE.reply('There was an error. Try again or contact the bot operators.');
    });
}

// Function to remove a game
function removeGame(MESSAGE) {
    if (!MESSAGE.member.permissions.has("ADMINISTRATOR")) {
        return;
    }
    var PARAMS = MESSAGE.content.split(' ').slice(1);
    var GAME = PARAMS[0];
    config.removeGame(MESSAGE.guild.id, GAME).then(RESULT => {
        MESSAGE.reply(`Success.\n **${GAME}** has been removed from the verified list.`);
    }).catch(err => {
        MESSAGE.reply(`Error.\n **${GAME}** is not in the verified list.`);
    });
}

// Function to show help
function help(MESSAGE) {
    MESSAGE.channel.send(`Here are my available commands:
    \!lfg GAMENAME\  - Creates a new guild
    \!lfg kill\  - Kills me
    \!lfgadd PLAYERLIMIT GAMENAME\  - Add a new playable game
    \!lfgremove PLAYERLIMIT\  - Remove a playable game
    \!lfgend\  - Terminate a currently active session (must be run in the session's text channel)
    \!lfg games\  - Shows all games playable
    \!lfg sessions\  - Shows all active sessions
    \!lfg purge\  - Removes all data associated with this server
    \!lfg clean roles\  - Removes all roles related to LFG
    \!lfg clean sessions\  - Removes all LFG sessions
    \!lfg about\  - Provides information about the bot
    \!lfg help\  - Shows this dialog (help). You already knew that.`);
}

// Function to show about information
function about(MESSAGE) {
    MESSAGE.channel.send(`LookingForGroup v${version}
    Developed by the LFG development team.
    https://github.com/starsky135/LookingForGroup
    We <3 Discord!`);
}

// Function to show games
function showGames(MESSAGE) {
    var allGames = 'Here are all the available games:';
    const gamesObject = config.getGames(MESSAGE.guild.id);
    const gamesObjectKeys = Object.keys(gamesObject);
    gamesObjectKeys.forEach((key, index) => {
        allGames += '\n**' + key + '** (max. ' + gamesObject[key]['LIMIT'] + ')';
        if (index < (gamesObjectKeys.length - 1)) {
            allGames += ', ';
        }
    });
    MESSAGE.channel.send(allGames);
}

// Function to show sessions
function showSessions(MESSAGE) {
    var allSessions = 'Here are all the available sessions:';
    var sessionsArray = config.getSessions(MESSAGE.guild.id);
    sessionsArray.forEach((val, index) => {
        allSessions += '\n**' + val[0] + '** (' + val[1] + '/' + val[2] + ')';
        if (index < (sessionsArray.length - 1)) {
            allSessions += ', ';
        }
    });
    MESSAGE.channel.send(allSessions);
}

// Function to add LFG
function addLFG(MESSAGE) {
    var AUTHOR = MESSAGE.author,
        GUILD_ID = MESSAGE.guild.id,
        PARAMS = MESSAGE.content.split(' ').slice(1);
    GAME = PARAMS[0];
    config.getGame(GUILD_ID, GAME).then(RESULT => {
        if (RESULT === false) {
            return MESSAGE.reply(`Error.
                Invalid game specified (Please contact a server admin to add the game).
                Alternatively, if you are an admin use the !lfgadd command.`);
        }
        USER_ROLES = MESSAGE.member.roles.cache;
        if (USER_ROLES.some(role => role.name === "lfg")) {
            return MESSAGE.reply(`Error.
              You are already in a group. Please leave the group or contact the server admin for help.`);
        }
        if (config.findSession(GUILD_ID, GAME) === false) {
            MESSAGE.guild.roles.create({
                name: 'lfg'
            }).then(ROLE => {
                const games = config.getGames(GUILD_ID);
                let LOBBY_LIMIT;
                if (PARAMS[1] == null) {
                    LOBBY_LIMIT = games[GAME]['LIMIT'];
                } else if (LOBBY_LIMIT > games[GAME]['LIMIT']) {
                    return MESSAGE.reply(`Error
                        You cannot have more than ${games[GAME]['LIMIT']} people in a group for this game.`);
                } else if (LOBBY_LIMIT < 2) {
                    return MESSAGE.reply(`Error
                        There must be at least 2 people in a group.`);
                } else if (!Number.isInteger(LOBBY_LIMIT)) {
                    return MESSAGE.reply(`Error
                        Invalid number.`);
                } else {
                    LOBBY_LIMIT = PARAMS[1];
                }

                MESSAGE.member.roles.add(ROLE).then(() => {
                    MESSAGE.guild.channels.create('lfg_' + GAME.toLowerCase() + ROLE.id.toString(), {
                        type: 'GUILD_TEXT'
                    }).then(TEXT_CHANNEL => {
                        TEXT_CHANNEL.permissionOverwrites.create(GUILD_ID, {
                            SEND_MESSAGES: false,
                            VIEW_CHANNEL: false
                        });
                        TEXT_CHANNEL.permissionOverwrites.create(ROLE, {
                            SEND_MESSAGES: true,
                            VIEW_CHANNEL: true
                        });
                        TEXT_CHANNEL.permissionOverwrites.create(bot.user, {
                            SEND_MESSAGES: true,
                            VIEW_CHANNEL: true,
                            ADMINISTRATOR: true
                        });
                        TEXT_CHANNEL.send('Text channel for ' + GAME);
                        TEXT_CHANNEL.send(`<@${AUTHOR.id}> Welcome to your group's text channel. You also have a voice channel to use.`);
                        TEXT_CHANNEL.send('Please don\'t forget to type !lfgend when you are done!');
                        MESSAGE.guild.channels.create('lfg_' + GAME.toLowerCase() + ROLE.id.toString(), {
                            type: 'GUILD_VOICE',
                            userLimit: LOBBY_LIMIT
                        }).then(VOICE_CHANNEL => {
                            VOICE_CHANNEL.permissionOverwrites.create(GUILD_ID, {
                                CONNECT: false
                            });
                            VOICE_CHANNEL.permissionOverwrites.create(ROLE, {
                                CONNECT: true
                            });
                            VOICE_CHANNEL.permissionOverwrites.create(bot.user, {
                                CONNECT: true
                            });
                            MESSAGE.reply(`Lobby for ${LOBBY_LIMIT} ${GAME} players. Click the + reaction below to join. Click it again to leave.`).then(m => {
                                m.react('➕');
                                config.createSession(GUILD_ID, AUTHOR.id, ROLE.id, GAME, TEXT_CHANNEL.id, VOICE_CHANNEL.id, m.id, m.channel.id);
                                config.addUser(GUILD_ID, ROLE.id, AUTHOR.id).then(data => {
                                    if (data == 'full') {
                                        MESSAGE.channel.send('**' + GAME + '** is now full!');
                                    } else {
                                        MESSAGE.channel.send(config.data[GUILD_ID][ROLE.id].members.length + '/' + data[1] + ' members has joined **' + GAME + '**');
                                    }
                                });
                            });
                        }).catch(err => {
                            console.error(err);
                        });
                    }).catch(err => {
                        console.error(err);
                    });
                });
            });
        } else {
            MESSAGE.channel.send("so we'd put you in a lobby right now but someone broke the code so lol. run !lfg clean sessions.");
        }
    });
}

// Function to delete creation message
function deleteCreationMessage(guild, groupID) {
    const session = config.getSession(guild.id, groupID);
    guild.channels.cache.get(session['channelid']).messages.fetch(session['messageid']).then(message => message.delete());
}

// Function to clean roles
function cleanRoles(MESSAGE) {
    if (sudoMode.includes(MESSAGE.guild.id)) {
        sudoMode.splice(sudoMode.indexOf(MESSAGE.guild.id), 1);
        MESSAGE.channel.send("Cleaning...");
        const CLEAR_ROLES = MESSAGE.guild.roles.cache.filter(role => role.name.startsWith("lfg"));
        CLEAR_ROLES.forEach(role => role.delete());
        MESSAGE.channel.send("Cleaning is complete.");
    } else {
        sudoMode.push(MESSAGE.guild.id);
        MESSAGE.channel.send("WARNING: This will delete all roles associated with the LFG bot

