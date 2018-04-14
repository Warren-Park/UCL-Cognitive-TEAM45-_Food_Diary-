# UCL_TEAM_45_SERVER

## Image resizer
If your server supports "sharp", you can use better image resizer that works with various image sizes. In order to use an image resizer that utilises sharp, 
1. Add var sharp=require('sharp');
2. Delete a function called "image_resizer"
3. Add 
function image_resizer(filename,callback){
    sharp(path.join(basedir,filename))
        .resize(500)
        .toFile(path.join(basedir,filename+"_final"), (err, info) => callback(err));


}


