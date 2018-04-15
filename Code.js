const Telegraf = require('telegraf');
const app = new Telegraf(process.env.BOT_KEY, {username: process.env.BOT_NAME});
const Telegram = require('telegraf/telegram');
const telegram = new Telegram(process.env.BOT_KEY);
const hs = require('hearthstone-mashape')(process.env.mashapeKey);
const Promise = require('bluebird');
const hs_i = Promise.promisifyAll(require('hearthstone-mashape')(process.env.mashapeKey));
const removeMd = require('remove-markdown');
const request = require('request');
const cheerio = require('cheerio');
const googl = require('goo.gl');
googl.setKey(process.env.GGL);

require('dotenv').config();

const url = 'https://raw.githubusercontent.com/schmich/hearthstone-card-images/4.7.0/rel/';
const url_art = 'https://art.hearthstonejson.com/v1/orig/';
const ext = '.png';

app.command('start', (ctx) => {
    ctx.reply('Welcome to HearthsBot.\nLost? Use /help');
});

app.command('help', (ctx) => {
    ctx.reply('To search: /card [name] or via inline - @HearthsBot [name].\nTo search the card by ID, use /id [search].\nThe /secret command, returns an image.\nThe /dust command, returns a table with crafting/disenchanting values.\nTo search in another language, use /[locale] after name, like: /card [name]/deDE or /id [id]/deDE. The same goes for inline, but putting the [locale] before, like: @HearthsBot deDE/[name].\nThe command /locale, show all the supported language (default: enUS).\n/golden, /art, /sound and /quote uses the ID.\nTo send a feedback: /feedback [suggestion].\nNote: instead of using ID (in /id, /sound, etc.), use the complete name of the card (without typo and in any letter case)');
});

app.command('locale', (ctx) => {
    ctx.replyWithMarkdown('`enUS - English\nenGB - British English\ndeDE - German\nesES - Spanish\nesMX - Mexican Spanish\nfrFR - French\nitIT - Italian\nkoKR - Korean\nplPL - Polish\nptBR - Brazilian Portuguese\nruRU - Russian\nzhCN - Chinese\nzhTW - Tradicional Chinese\njaJP - Japanese\nthTH - Thai`');
});

app.command('secret', (ctx) => {
    ctx.replyWithMarkdown('[Secret Table (Outdated)](https://i.imgur.com/D35aRst.jpg)');
});

app.command('dust', (ctx) => {
    var Dust = ('⁣').link('http://i.imgur.com/2GKGoOk.png');
    ctx.replyWithHTML(`${Dust}`);
});


function flavor_md(flv){
    return (': ' + removeMd(flv.flavor));
}

function text_md(txt){
    if(txt.text == undefined)
        return ('⁣');
    return (': ' + removeMd(txt.text));
}

app.command('card', (ctx) => {
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var loc = 'enUS';
    
    if(key.search('/') != -1){
        key = key.split('/');
        loc = key[1];
        key = key[0];
    }

    var Name, Flavor, Cover, Id;
    
    var params = {
        name: key,
        collectible: 1, //True... collectible only
        locale: loc
    };
    
    hs.search(params, function(err, data){
        try{
            var i = 0;
            Name = data[i].name;

            if(data[i].flavor == undefined)
                Flavor = '⁣';
            else
                Flavor = flavor_md(data[i]);

            Cover = ('⁣').link(`${url}${data[i].dbfId}${ext}`)  + '\n';
            
            Id = '<b>ID</b>: ' + data[i].cardId;
            
            ctx.replyWithHTML(`<b>${Name}</b><i>${Flavor}</i>${Cover}${Id}`);
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

function inlineReply(json){
    var Name, Flavor, Cover, Id, Stats, Cost, Thumb;

    Name = json.name;

    if(json.flavor == undefined)
        Flavor = '⁣';
    else
        Flavor = flavor_md(json);

    Cost = `Cost: ${json.cost}\n`;
    
    if(json.img == undefined){
        Thumb = 'http://i.imgur.com/pgekEg6.png';
        Cover = '⁣\n';
        Flavor = text_md(json);
    }
    else{
        Thumb = `${url}${json.dbfId}${ext}`;
        Cover = `[⁣](${Thumb})\n`;
    }
    
    Stats = String(json.attack + '/' + json.health);

    if(json.type == 'Weapon')
        Stats = String(json.attack + '/' + json.durability);

    else if(json.type == 'Spell')
        Stats = 'Spell';

    else if(json.type == 'Hero'){
        Stats = 'Hero';
        Cost = '⁣';
    }

    else if(json.type == 'Hero Power'){
        Stats = 'Hero Power';
        Cost = '⁣';
    }
    
    else if(json.type == 'Enchantment'){
        Stats = 'Enchantment';
        Cost = '⁣';
    }
    
    Id = '*ID*: ' + json.cardId;
    Id = Id.replace(/_/g, '\\_'); // \_ for md
    
    return{
        type: 'article',
        id: Id,
        title: `${json.name}`,
        description: `${Cost}Stats: ${Stats}`,
        thumb_url: Thumb,
        input_message_content:{
            message_text: `*${Name}*_${Flavor}_${Cover}${Id}`,
            parse_mode: 'Markdown'
        }
    };
}

function inlineAnswer(list){
    return Promise.all(list.map(json => inlineReply(json)))
        .catch(issue => console.log( 'Promise: ' + issue));
}

function inlineSearch(inline){
    if('' == inline)
        return Promise.all([{
            type: 'article',
            id: '0',
            title: 'You don\'t have enough mana!',
            description: 'Type a card name',
            thumb_url: 'http://i.imgur.com/JpZN4Ae.png',
            input_message_content:{
                message_text: '`W E L L   P L A Y E D !`',
                parse_mode: 'Markdown'
            }
        }]);
    else{
        var unlock = 1, loc = 'enUS';

        if(inline.search('sudo') != -1){
            inline = inline.split('sudo');
            unlock = 0;
            inline = inline[1].trim();
        }

        if(inline.search('/') != -1){
            inline = inline.split('/');
            loc = inline[0];
            inline = inline[1].trim();
        }
        
        var params = {
            name: inline.replace(/&#39;/, '\''),
            collectible: unlock,
            locale: loc
        };

        return hs_i.searchAsync(params).then(list => inlineAnswer(list))
            .catch(issue => {
                console.log('Not find: ' + issue);
                return [{
                    type: 'article',
                    id: '0',
                    title: 'Not Found!',
                    description: 'Retry. If you wish.',
                    thumb_url: 'http://i.imgur.com/g3cJJ8O.png',
                    input_message_content:{
                        message_text: '`W E L L   P L A Y E D !`',
                        parse_mode: 'Markdown'
                    }
                }];
            });
    }
}

app.on('inline_query', ctx => {
    const inline = ctx.inlineQuery.query;
    
    inlineSearch(inline).then(results => ctx.answerInlineQuery(results))
        .catch(issue => {
            console.log('inlineSearch: ', issue);
            if(issue.description == 'Bad Request: RESULTS_TOO_MUCH')
                telegram.sendMessage(process.env.ID, inline);
        });
});

//usefull for lang change
app.command('id', (ctx) => { 
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var loc = 'enUS';
    
    if(key.search('/') != -1){
        key = key.split('/');
        loc = key[1];
        key = key[0];
    }

    var Name, Flavor, Cover, Id;
    
    var params = {
        name: key,
        collectible: 0,
        locale: loc
    };
    
    hs.card(params, function(err, data){
        try{
            var i = 0;
            Name = data[i].name;

            if(data[i].flavor == undefined)
                Flavor = '⁣';
            else
                Flavor = flavor_md(data[i]);
                        
            if(data[i].img == undefined){
                Cover = '\n';
                Flavor = text_md(data[i]);
            }
            else
                Cover = ('⁣').link(`${url}${data[i].dbfId}${ext}`) + '\n';

            Id = '<b>ID</b>: ' + data[i].cardId;
            
            ctx.replyWithHTML(`<b>${Name}</b><i>${Flavor}</i>${Cover}${Id}`);
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

//secret: return json
app.command('info', (ctx) => {
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var loc = 'enUS';
    
    if(key.search('/') != -1){
        key = key.split('/');
        loc = key[1];
        key = key[0];
    }

    var params = {
        name: key,
        collectible: 0,
        locale: loc
    };

    hs.card(params, function(err, data){
        try{
            var i = 0;
            ctx.replyWithHTML(`<code>${removeMd(JSON.stringify(data[i], null, 4))}</code>`);
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

app.command('sound', (ctx) => {
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var params = {
        name: key,
        collectible: 0,
    };
    
    hs.card(params, function(err, data){
        try{
            var i = 0, k;
            var Name = data[i].name; 
            
            var pageURL = 'https://maxtimkovich.com/hearthsounds?q=' + Name;
            request(pageURL, function(error, response, responseHtml){
                var $ = cheerio.load(responseHtml);
                var i = 0, snd = [], name = [];
                
                $('.list-group-item').each(function(){
                    snd[i] = $(this).attr('href');
                    name[i] = $(this).text();
                    i++;
                });
                
                if(Name == 'Alexstrasza')
                    k = 8;
                else if(Name == 'C\'Thun')
                    k = 5;
                else
                    k = 1;
                    
                for(; k < snd.length; k++){
                    ctx.telegram.sendVoice(ctx.chat.id, snd[k], {caption: name[k].trim()});
                    if (snd[k+1] == undefined) //divide cards
                        break; //snd[k+1] = '\0';
                }
            });
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

app.command('quote', (ctx) => {
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var params = {
        name: key,
        collectible: 0,
    };
    
    hs.card(params, function(err, data){
        try{
            var i = 0;
            var Name = data[i].name; 
            if(Name == 'Ragnaros, Lightlord'){
                ctx.replyWithHTML('<b>Summon</b>: THE LIGHT PURGES!');
                ctx.replyWithHTML('<b>Effect triggering</b>: LIVE, INSECT!');
                ctx.replyWithHTML('<b>Attack</b>: DIE, INSECT!');
                ctx.replyWithHTML('<b>Death</b>: STILL TOO SOON...');
            }
            else if(Name == 'C\'Thun'){
                ctx.replyWithHTML('<b>Summon</b>: My dreaming ends... Your nightmare... begins...');
                ctx.replyWithHTML('<b>Attack</b>: Sleep!');
                ctx.replyWithHTML('<b>Revealing C\'Thun through a related card</b>:\nYour minions will abandon you.\nDeath... is close.\nYour deck betrays you.\nYou have already lost.\nCaress your fear.\nYour minions think you are weak.\nHope is an illusion.\nIt was your fault.\nThat was a mistake.\nFlee, screaming.\nGive in, to your fear.\nWell met.');
            }
            else if(Name == 'Barnes'){
                ctx.replyWithHTML('<b>Summon</b>:\nTonight, a tale of glorious redemption.\nTonight, a tale of terrible tragedy.\nTonight, a tale of wonder and magic.\nTonight, a tale of long lost worlds.\nTonight, a tale of true terror.');
                ctx.replyWithHTML('<b>Attack</b>: On with the show!');
            }
            else{
                var pageURL = 'https://hearthstone.gamepedia.com/' + Name;
                
                request(pageURL, function(error, response, responseHtml){
                    var $ = cheerio.load(responseHtml);
                    //i = $('#mw-content-text').find('dt').first().text();
                    if($('#mw-content-text').find('dt').text() == '')
                        ctx.reply('Incomprehensible quotes 😦');
                    else
                        $('#mw-content-text').find('dt').each(function(){
                            ctx.replyWithHTML('<b>' + $(this).text() + '</b>: ' + $(this ).next().text());
                        });
                });
            }
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

app.command('golden', (ctx) => {
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var params = {
        name: key,
        collectible: 0,
    };
    
    hs.card(params, function(err, data){
        try{
            var i = 0, Golden = data[i].imgGold;
            
            if(data[i].imgGold == undefined)
                ctx.reply('No golden version 😦');
            else{
                googl.shorten(Golden)
                    .then(function (Site){
                        ctx.telegram.sendDocument(ctx.chat.id, Site).catch(issue => {
                            console.log(issue);
                            ctx.reply('No golden version 😦');
                        });
                    })
                    .catch(function (err){
                        console.error(err.message);
                    });
            }
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

app.command('art', (ctx) => {
    var key = ctx.message.text.replace(/[^\s]+ /, '').trim();
    
    var params = {
        name: key,
        collectible: 0,
    };
    
    hs.card(params, function(err, data){
        try{
            var i = 0, Art;
            if(data[i].img != undefined){
                Art = `[⁣](${url_art}${data[i].cardId}${ext}`;
                ctx.replyWithMarkdown(Art);
            }
            else            
                ctx.reply('No art available 😦');
        }
        catch(error){
            console.log('\nError : ' + err);
            ctx.reply('Card not found 😦');
        }
    });
});

//Rip patches ;D
app.command('patches', (ctx) => {
    var filePath = './Sounds/pirate.opus';
    ctx.telegram.sendVoice(ctx.chat.id, {source: filePath}, {caption: 'I\'m in charge now!'});
});

app.startPolling();
