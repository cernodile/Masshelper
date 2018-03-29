var timestamp = Date.now();
var config = require("./config.json");
var game = process.argv[2];
var data = require(config.datafiles[game]); // Items to fetch from -- Currently Growtopia
var archy = require('archy'); // Archy module - used to generate the tree theme
var target = process.argv[3] || "Grass"; // User-specified block or default of "Grass"
var compact = process.argv[5] || "false"; // Whether to compact the tree to farmables & whitelisted blocks
var useArchy = process.argv[6] || "false"; // Whether to use archy theme or not
(compact === "true" ? compact = true : compact = false); // Compact - To farmables & whitelist
(useArchy === "true" ? useArchy = true : useArchy = false); // Classic
var str = ""; // Collect data from parser
var collector = {}; // How many seeds needed
var skip = data.whitelist; // Whitelisted items/blocks
var totalTime = 0;
function growTime (rar) {
  switch (game) {
    case "growtopia":
      return Math.floor(Math.pow(rar, 3) + 30 * rar);
    case "pixelworlds":
      var k = Math.floor(Math.pow(rar, 3.2) + 30.0 * Math.pow(rar, 1.4));
      if (k >= 3153600) k =  3153600;
      if (k <= 30) k = 30;
      if (rar <= 0) k = 8640000;
      return k;
    default:
      return 0;
  }
}
function getAvgBlocks (M, x = 1) {
  return Math.round((5 * (M * 4) + 20) / 16 * x);
}
function getAvgSeedFromTree (R, x) {
  return Math.round(x * 4 / (R + 12));
}
function getEndSeeds (amt) {
  var extraBlock = 0;
  var left = amt;
  while (left > 0) {
    extraBlock += left / 12;
    left = left / 12;
  }
  return Math.round((amt + extraBlock) / 4);
}
String.prototype.capitalize = function(){
  return this.replace(/(^|-|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
};
var object = {label: target.capitalize(), 'nodes': []};
if (data.items.hasOwnProperty(target.toLowerCase())) {
  var t = data.items[target.toLowerCase()];
  object.label = object.label + (t.farmable ? " [F]" : "") + (t.comment ? " (" + t.comment + ")" : "");
  var x = t.rarity;
  if (x !== 999) totalTime += growTime(x);
  if (t.splicable) {
    if (useArchy) {
      str += "\n";
      generateTree(t.recipe, 1);
    } else {
      str += ("\n" + t.recipe.join(" + ") + " = " + target.toLowerCase()).capitalize();
      generateList(target.toLowerCase(), t.recipe);
    }
  } else str += "Not Splicable - ";
} else return process.send("ERR: Invalid query");
function getRecipe (item) {
  if (!data.items[item]) {
    if (process.send) process.send("ERR: Missing previous tier(s) data. This should get fixed ASAP!\nMissing item is: " + item);
    return process.exit(0);
  }
  if (data.items[item].recipe) {
    return data.items[item].recipe;
  } else return false;
}
function addToCollector (item) {
  if (collector.hasOwnProperty(item)) {
    return collector[item]++;
  } else return collector[item] = 1;
}
function generateTree (recipe, indent) {
  for (var k in recipe) {
    if (getRecipe(recipe[k])) {
      if (data.items[recipe[k]].farmable && compact || skip.indexOf(recipe[k]) > -1 && compact) {
        object.nodes[k] = recipe[k].capitalize() + (data.items[recipe[k]].farmable ? " [F]" : "") + (data.items[recipe[k]].comment ? " (" + data.items[recipe[k]].comment + ")" : "");
        addToCollector(recipe[k]);
      } else {
        var x = data.items[recipe[k]].rarity;
        if (x !== 999) totalTime += growTime(x);
        object.nodes[k] = createNode(recipe[k], getRecipe(recipe[k]));
      }
    } else {
      object.nodes[k] = recipe[k].capitalize() + (data.items[recipe[k]].farmable ? " [F]" : "") + (data.items[recipe[k]].comment ? " (" + data.items[recipe[k]].comment + ")" : "");
      addToCollector(recipe[k]);
    }
  }
}
function generateList (name, recipe) {
  for (var k in recipe) {
    if (getRecipe(recipe[k])) {
      if (data.items[recipe[k]].farmable && compact || skip.indexOf(recipe[k]) > -1 && compact) {
        addToCollector(recipe[k]);
      } else {
        var x = data.items[recipe[k]].rarity;
        if (x !== 999) totalTime += growTime(x);
        var x = getRecipe(recipe[k]);
        var c = []
        if (x.length === 2) { // Standard recipe
          var d = data.items;
          c.push(x[0] + (d[x[0]].farmable ? " [F]" : "") + (d[x[0]].comment ? " (" + d[x[0]].comment + ")" : ""));
          c.push(x[1] + (d[x[1]].farmable ? " [F]" : "") + (d[x[1]].comment ? " (" + d[x[1]].comment + ")" : ""));
        }
        str += (
          "\n" +
          c.join(" + ") +
          " = " +
          recipe[k]).capitalize();
        generateList(recipe[k], getRecipe(recipe[k]));
      }
    } else {
      var x = recipe;
      var c = []
      if (x.length === 2) { // Standard recipe
        var d = data.items;
        c.push(x[0] + (d[x[0]].farmable ? " [F]" : "") + (d[x[0]].comment ? " (" + d[x[0]].comment + ")" : ""));
        c.push(x[1] + (d[x[1]].farmable ? " [F]" : "") + (d[x[1]].comment ? " (" + d[x[1]].comment + ")" : ""));
      }
      str += ("\n" + c.join(" + ") + " = " + name).capitalize();
      addToCollector(recipe[k]);
    }
  }
}
function createNode (name, recipe) {
  if (!data.items[recipe[0]] || !data.items[recipe[1]]) {
    if (process.send) process.send("ERR: Missing previous tier data. This should get fixed ASAP!\nMissing item is: " + (!data.items[recipe[0]] ? recipe[0] : recipe[1]));
    return process.exit(0);
  }
  var obj = {
    label: name.capitalize() + (data.items[name].farmable ? " [F]" : "") + (data.items[name].comment ? " (" + data.items[name].comment + ")" : ""),
    nodes: [
      recipe[0].capitalize() + (data.items[recipe[0]].farmable ? " [F]" : "") + (data.items[recipe[0]].comment ? " (" + data.items[recipe[0]].comment + ")" : ""),
      recipe[1].capitalize() + (data.items[recipe[1]].farmable ? " [F]" : "") + (data.items[recipe[1]].comment ? " (" + data.items[recipe[1]].comment + ")" : "")
    ]
  };
  for (var j in recipe) {
    if (getRecipe(recipe[j])) {
      if (data.items[recipe[j]].farmable && compact || skip.indexOf(recipe[j]) > -1 && compact) {
        addToCollector(recipe[j]);
      } else {
        var x = data.items[recipe[j]].rarity;
        if (x !== 999) totalTime += growTime(x);
        obj.nodes[j] = createNode(recipe[j], getRecipe(recipe[j]))
      }
    } else addToCollector(recipe[j]);
  }
  return obj;
}
function list (obj, amt) {
  var msgArray = [];
  if (data.items[target].recipe) msgArray.push("\nRequired items to create " + amt + " of product:");
  for (var key in obj) {
    msgArray.push(key.capitalize() + ": " + Math.floor(obj[key] * amt));
  }
  return msgArray.join("\n");
}
if (!useArchy) {
  var explode = str.split("\n");
  var tempObj = {};
  for (var i in explode) {
    if (explode[i].length > 0) {
      if (tempObj.hasOwnProperty(explode[i])) {
        tempObj[explode[i]].amount++;
      } else tempObj[explode[i]] = {amount: 1};
    }
  }
  for (var key in tempObj) {
    if (tempObj[key].amount > 1) {
      function theDuplicates(a,b,c,d){//array,placeholder,placeholder
        b=a.length,d=[];
        while(c=--b)while(c--)a[b]!==a[c]||d.push(a.splice(c,1))
      }
      theDuplicates(explode);
      explode[explode.indexOf(key)] = "[" + tempObj[key].amount + "x] " + explode[explode.indexOf(key)];
    } else explode[explode.indexOf(key)] = "[" + tempObj[key].amount + "x] " + explode[explode.indexOf(key)];
  }
  str = explode.join("\n");
}
function formatTime (s) {
  let d = Math.floor(s / 60 / 60 / 24);
  let h = Math.floor(s / 60 / 60 % 24);
  let m = Math.floor(s / 60 % 60);
  let sec = Math.floor(s % 60);
  let parsedString = [];
  if (d > 0) parsedString.push(d + "d");
  if (h > 0) parsedString.push(h + "h");
  if (m > 0) parsedString.push(m + "m");
  if (sec > 0) parsedString.push(sec + "s");
  return parsedString.join(" ");
}
var result = "Masshelper\n\nIf you were to splice and had to count time\nfor trees to grow, it'd take around " + formatTime(totalTime) + "\n\n[F] means the block is farmable!\n" + (useArchy ? "" : "[1x] Means X the amount of trees you're creating.\n\nUsing Classic Theme\n") + str + (useArchy ? archy(object) : "\n") + list(collector, parseInt(process.argv[4])) + "\n\nTime taken: " + (Date.now() - timestamp) + "ms.";
console.log(result);
if (process.send) return process.send(result);
