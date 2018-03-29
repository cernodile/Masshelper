var timestamp = Date.now();
var config = require("./config.json");
var game = process.argv[2];
var data = require(config.datafiles[game]);
var target = process.argv[3];
var str = "Masshelper - Recipe Possibilities Branch\n\n";
var collector = {};
var am = 0;
var skip = data.whitelist;
String.prototype.capitalize = function(){
  return this.replace(/(^|-|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
};
function generateImg (id, seed) {
  if (!id) return "";
  var multiplier = 32;
  if (seed) multiplier = 16;
  var left = "-" + Math.floor(id / 2 % 32) * multiplier + "px";
  var top = "-" + Math.floor(id / 2 / 32) * multiplier + "px";
  var imgLink = `<img src="/${seed ? "seedsheet" : "spritesheet"}" alt="Sprites" class="" data-image-key="Sprites.png" data-image-name="Sprites.png" width="${seed ? 512 : 1024}" height="${seed ? 1248 : 2496}" style="top:${top};left:${left};position:relative;">`;
  //return "<span class='sprite" + (seed ? " seed" : "") + "'>" + imgLink + "</span> ";
  if (game === "growtopia") return "<span class='sprite" + (seed ? " seed" : "") + "'>" + imgLink + "</span> ";
  return "";
}
if (data.items.hasOwnProperty(target.toLowerCase())) {
  var t = data.items[target.toLowerCase()];
  str += "Results for: " + generateImg(t.id) + target.toLowerCase().capitalize() + (t.multifruit ? " [SF]" : "") + "\n";
  for (var key in data.items) {
    if (data.items[key].recipe && !data.items[key].combiner) {
      if (data.items[key].recipe.indexOf(target.toLowerCase()) > -1) {
        data.items[key].recipe.splice(data.items[key].recipe.indexOf(target.toLowerCase()), 1);
        am++;
        console.log(key, data.items[key], data.items[data.items[key].recipe[0]])
        str += (generateImg(t.id, true) + target.toLowerCase() + " + " + generateImg(data.items[data.items[key].recipe[0]].id, true)  + data.items[key].recipe[0] + " = " + generateImg(data.items[key].id) + key.capitalize() + (data.items[key].multifruit ? " [SF]" : "") + "\n").capitalize();
      }
    }
  }
} else return process.send("ERR: Invalid query");
if (am === 0) str += "No results found";
var result = str + "\n\nTime taken: " + (Date.now() - timestamp) + "ms.";
console.log(result);
if (process.send) return process.send(result);
