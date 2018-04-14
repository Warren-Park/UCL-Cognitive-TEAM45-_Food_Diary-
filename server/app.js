var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var azure = require('azure-storage');
var index = require('./routes/index');
var users = require('./routes/users');
var request_=require('request');
var fs=require('fs');
var ms_vision=require('microsoft-computer-vision');
var ms_emotion=require('cognitive-services');
var googleDrive = require('google-drive');
var NodeGeocoder = require('node-geocoder');
var mysql = require('mysql2');
var ExifImage = require('exif').ExifImage;
var yelp =require('yelp-fusion');
var resize=require('resizer-stream');
var JPEGDecoder = require('jpg-stream/decoder');
var JPEGEncoder = require('jpg-stream/encoder');
var app = express();
var blobSvc=azure.createBlobService("YOUR-AZURE-STORAGE-KEY");


//DON'T FORGET TO NPM INSTALL FRAMEWORKS ON AZURE. In case you use Github deployment, npm install will happen automatically.
/*######################################################################################################################################################
                                                                                                                                                                                                                                         
                                                                                                           
This is the Main Server Node.js app for the Food Diary web application.

Developed by Warren Park
Copyright Microsoft 2018. All rights reserved.
                                                                                                           
                                                                                                         

######################################################################################################################################################
*/






var yelp_client=yelp.client("YOUR-YELP-CLIENT-ID");
var connection = mysql.createConnection({
  host     : "YOUR-MYSQL-HOST-NAME",
  user     : 'YOUR-MYSQL-USER-NAME',
  password : 'YOUR-MYSQL-PASSWORD',
  database : 'food'
});

var basedir=__dirname;

var options={
  provider: 'google',
  httpAdapter: 'https',
  apiKey: 'YOUR-GOOGLE-GEOCODING-API-KEY',
  formatter:null
};
var geocoder = NodeGeocoder(options);

//Permission settings
app.use(function(req,res,next){
  res.header("Access-Control-Allow-Origin","*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

//Declare the use of urlencoded type http request.
app.use(bodyParser.urlencoded({
  extended: true

}));

http.createServer(function(req,res){
  res.writeHead(200,{
    'Content-Type':'text/plain',
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'POST'
  });
});

//POST request process.
app.post('',function(req,resp){
  console.log("HTTP POST HAS BEEN RECEIVED.");
  //obtain parameters from request
  var mode=req.body.mode;
  var UUID=req.body.UUID;
  console.log(UUID);
  if(mode=="CREATE"){
    var image_url_food = req.body.image_url_food;
    var image_url_face = req.body.image_url_face;
    var TOKEN=decodeURIComponent(req.body.TOKEN);
    var source=req.body.source;
    var card_id="";
    console.log(UUID);
    console.log(image_url_food);
    console.log(image_url_face);
    data_processor(UUID,image_url_food,image_url_face,TOKEN,source,function(res){
      console.log(res);
      card_id=res;
      resp.send("CREATED "+card_id);
    });
  }else if(mode=="DELETE"){
    var card_id=req.body.card_id;
    blobSvc.deleteBlob(UUID,card_id.toString(),function(error){
      if(!error){
        console.log("Deleted");
      }else{
        resp.send("Delete failed");
      }
    });
    blobSvc.deleteBlob(UUID,card_id.toString()+"_txt",function(error){
      if(!error){
        console.log("Deleted");
      }else{
        resp.send("Delete failed");
      }
    });
    var sql_query="DELETE FROM food.food WHERE user='"+UUID.toString()+"' AND card_id='"+card_id.toString()+"';";
    general_SQL(sql_query,function(res){
      resp.send(res);
    });


  }else if(mode=="MAP_SEARCH"){
    var latitude=req.body.latitude;
    var longitude=req.body.longitude;
    var id_list=[];
    var sql_query="SELECT * FROM food.food WHERE user='"+UUID.toString()+"' AND latitude >= '"+(latitude-0.01).toString()+"' AND latitude <= '"+(latitude+0.01).toString()+"' AND longitude >= '"+(longitude-0.01)+"' AND longitude <= '"+(longitude+0.01).toString()+"' ORDER BY date DESC;"; //ABOUT 1.1km range
    general_SQL(sql_query,function(res){
      if(res){
        res.forEach(function(item){
          id_list.push(item["card_id"]);
        });
        resp.send(id_list);
      }
      else{
        resp.send("NOT FOUND ANY");
      }
    });

  }else if(mode=="SEARCH"){
    console.log("SEARCH");
    var term=req.body.term;
    var sql_query='SELECT * FROM food.food WHERE user="'+UUID.toString()+'" AND (tags LIKE "%'+term.toString()+'%" OR title LIKE "%'+term.toString()+'%" OR address LIKE "%'+term.toString()+'%" OR allergens LIKE "%'+term.toString()+'%"'+') ORDER BY date DESC;';
    console.log(sql_query);
    var id_list=[];
    general_SQL(sql_query,function(res){
      if(res){
        if(res!="SQL ERROR"){
          console.log(res);
        res.forEach(function(item){
          id_list.push(item["card_id"]);
        });
        }
        
      }
      resp.send(id_list);
    });

  }else if(mode=="DATE"){
    var start=req.body.start;
    var end=req.body.end;
    var id_list=[];
    var sql_query="SELECT * FROM food.food WHERE user='"+UUID.toString()+"' AND date>'"+start.toString()+"' AND date<'"+end.toString()+"';";
    general_SQL(sql_query,function(res){
      if(res){
        if(res=="SQL ERROR"){
          resp.send([]);
        }else{
          res.forEach(function(item){
            id_list.push(item["card_id"]);
          });
          resp.send(id_list);
        }
      }
      else{
        resp.send("NOT FOUND ANY");
      }
    });

  }else if(mode=="MODIFY"){
    var card_id=req.body.card_id;
    var title=decodeURIComponent(req.body.title);
    var date=decodeURIComponent(req.body.date);
    var star=req.body.star;
    var feeling=req.body.feeling;
    var location=decodeURIComponent(req.body.location);
    var tags=decodeURIComponent(req.body.tags);
    var comments=decodeURIComponent(req.body.comments);
    var allergens=decodeURIComponent(req.body.allergens);
    rewrite_card(UUID,card_id,title,date,star,feeling,location,tags,comments,allergens,function(res){
     if(res=="SUCCESS"){
       resp.send("SUCCESS");
     }else{
       resp.send("FAILED");
     }

   });

   }else if(mode=="MAP_VIEW"){
    var sql_query="SELECT * FROM food.food WHERE user='"+UUID.toString()+"' ORDER BY date DESC;";
    var list_to_send = [];
    console.log("MAP");
    general_SQL(sql_query,function(res){
      if(res!="SQL ERROR"){
        res.forEach(function(item){
          list_to_send.push([item["card_id"],item["title"],item["latitude"],item["longitude"]]);
        });
        resp.send(list_to_send);
      }else{
        resp.send("MAP ERROR");
      }
    });
    
  }else if(mode=="SET_DEFAULT_LOCATION"){
    var address=req.body.address;
    var latitude;
    var longitude;

    var sql_query="SELECT * FROM food.user_locations WHERE user_id='"+UUID.toString()+"';";
    general_SQL(sql_query,function(res){
      if(res!="SQL ERROR"){
        reverse_geocoder(address,function(res){
          console.log(res);
          latitude=res[0];
          longitude=res[1];
          if(res.length>0){
            sql_query="UPDATE food.user_locations SET location='"+address+"', latitude='"+latitude.toString()+"', longitude='"+longitude.toString()+"' WHERE user_id='"+UUID.toString()+"';";
          }else{
            sql_query="INSERT INTO food.user_locations(id,user_id,location,latitude,longitude) VALUES (NULL,'"+UUID.toString()+"','"+address+"','"+latitude.toString()+"','"+longitude.toString()+");";
          }
          general_SQL(sql_query,function(res){
            if(res!="SQL ERROR"){
              console.log("Successfully updated user locations");
              resp.send("SUCCESS");
            }
            else{
              resp.send("ERROR");
            }
          });

        });
      }
      else{
        resp.send("ERROR");
      }

    });

  }else if(mode=="SUGGEST"){
    //SUGGESTION ENGINE POWERED BY YELP API
    console.log("SUGGESTION");
    var sql_query="SELECT * FROM food.user_locations WHERE user_id='"+UUID.toString()+"';";
    var latitude="";
    var longitude="";
    var tags="";
    console.log("NO PROBLEM");
   tags_for_suggestion(UUID,function(res){
      tags=res;
      console.log(tags);
      general_SQL(sql_query,function(res){
        if(res.length>0){
          console.log(res);
          console.log(res.length);
          latitude=res[0]["latitude"];
          longitude=res[0]["longitude"];
        }else{
          latitude=51.5358331;
          longitude=-0.1603133;
          sql_query="INSERT INTO food.user_locations(id,user_id,location,latitude,longitude) VALUES (NULL,'"+UUID.toString()+"','"+"Gower St, Bloomsbury, London WC1E 6BT"+"','"+latitude.toString()+"','"+longitude.toString()+"');";
          general_SQL(sql_query,function(res){
            if(res=="ERROR"){
              resp.send("ERROR");
            }
          });
        }
        
        console.log(location);
        yelp_suggestion(tags,latitude,longitude,function(res){
          resp.send([res["businesses"][0],res["businesses"][1],res["businesses"][2]]);
        });
      });
  });
    
  }else if(mode=="DELETE_ACCOUNT"){
    //DELETES DB and BLOB STORAGE
    blobSvc.deleteContainerIfExists(UUID,function(err,tf,res){
      if(!err){
        console.log("container successfully deleted");
      }else{
        console.log("CONTAINER DELETE FAILDED")
      }
    });
    var sql_query="DELETE FROM food.food WHERE user='"+UUID.toString()+"';";
    general_SQL(sql_query,function(res){
      if(res){
        console.log("DB deletion completed.");
        sql_query="DELETE FROM food.user_locations WHERE user_id='"+UUID.toString()+"';";
        general_SQL(sql_query,function(res){
          if(res=="SQL ERROR"){
            resp.send("ERROR");
          }else{
            resp.send("SUCCESS");
          }
        });
      }
      else{
        resp.send("NOT FOUND ANY");
      }
    }); 
  }else if(mode=="LIST"){
    var sql_query="SELECT * FROM food.food WHERE user='"+UUID.toString()+"' ORDER BY date DESC;";
    var id_list=[];
    general_SQL(sql_query,function(res){
      if(res){
        if(res!="SQL ERROR"){
        res.forEach(function(item){
          id_list.push(item["card_id"]);
        });
      }
      sql_query="SELECT * FROM food.user_locations WHERE user_id='"+UUID.toString()+"';";
      general_SQL(sql_query,function(res){
        if(res=="SQL ERROR"){
          resp.send("ERROR");
        }else{
          if(res.length>0){
            console.log("Already registered.");
          }
          else{
            sql_query="INSERT INTO food.user_locations(id,user_id,location,latitude,longitude) VALUES (NULL,'"+UUID.toString()+"','LONDON','51.5287718','-0.2416816');";
            general_SQL(sql_query,function(res){
              if(res=="SQL ERROR"){
                resp.send("ERROR");
              }else{
                console.log("Registered.");
              }
            });
          }
        }
      });

      }
      resp.send(id_list);
    });

  }else if(mode=="REGISTER"){
    var address=req.body.address;
    var sql_query="INSERT INTO food.user_locations(id,user_id,location) VALUES (NULL,'"+UUID.toString()+"','"+address+"');";
    general_SQL(sql_query,function(res){
      if(res=="ERROR"){
        resp.send("ERROR");
      }else{
        resp.send("SUCCESS");
      }
    });
  }else if(mode=="FETCH"){
    var card_id=req.body.card_id;
    var sql_query="SELECT * FROM food.food WHERE user='"+UUID.toString()+"' AND card_id='"+card_id.toString()+"';";
    general_SQL(sql_query,function(res){
      if(res=="SQL ERROR"){
        resp.send("ERROR");
      }else{
        resp.send([res[0]["title"],res[0]["date"],res[0]["star"],res[0]["tags"],res[0]["address"],res[0]["allergens"]]);
      }
    });
  }else if(mode=="STAR"){
    var sql_query="SELECT * FROM food.food WHERE user='"+UUID.toString()+"' ORDER BY date ASC;";
    var date_star_pair=[];
    general_SQL(sql_query,function(res){
      if(res=="SQL ERROR"){
        resp.send("ERROR");
      }else{
        res.forEach(function(elem){
          date_star_pair.push([elem["date"].toISOString().substring(0,10),elem["star"]]);
        });
        resp.send(date_star_pair);
      }
    });
  }else if(mode=="MODE"){
    var selection=req.body.selection;
    var bool_selection="";
    if(selection="TRUE"){
      bool_selection="TRUE";
    }else{
      bool_selection="FALSE";
    }
    var sql_query="UPDATE food.user_locations SET mode='"+bool_selection+"' WHERE user_id='"+UUID.toString()+"';";
    general_SQL(sql_query,function(res){
      if(res=="ERROR"){
        resp.send("ERROR");
      }else{
        resp.send("SUCCESS");
      }
    });

  }
  else if(mode="MODE_VIEW"){
    var sql_query="SELECT * FROM food.user_locations WHERE user_id='"+UUID.toString()+"';";
    general_SQL(sql_query,function(res){
      if(res=="ERROR"){
        resp.send("ERROR");
      }else{
        if(res=="TRUE"){
          resp.send("TRUE");
        }else{
          resp.send("FALSE");
        }
        
      }
    });
  }
  else{
    console.log("ELSE");
    resp.send("ERROR");
  }
  
  
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');




// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


function tags_for_suggestion(uuid,callback){
  console.log("TAGS");
  var sql_query="";
  var tags=[];
  sql_query="SELECT * FROM food.food WHERE user='"+uuid.toString()+"' ORDER BY star DESC;";
  general_SQL(sql_query,function(res){
    if(res=="SQL ERROR"){

    }else{
      if(res.length>1){
        var text=res[0]["tags"].split(",");
        var cache=[];
        for(var i=1;i<6;i++){
          tags.push(text[i]);
        }
      }
  }
  if(tags.length==0){
    tags.push("food");
  }
  callback(tags);
  });
  
  
}

function yelp_suggestion(tags,lat,lng,callback){
  console.log("YELP");
  var tags_cache="";
  for(var i=0;i<tags.length;i++){
    tags_cache+=(tags[i]+",");
  }
  tags_cache=tags_cache.replace(" ","");
  tags_cache=tags_cache.replace("    ","");
  tags_cache=tags_cache.replace("\n","");
  tags_cache=tags_cache.replace("'","");
  console.log(tags_cache);
  console.log("lat lng");
  console.log(lat,lng);
  yelp_client.search({
    term: tags_cache,
    latitude: lat,
    longitude: lng
  }).then(response =>{
    console.log(response.jsonBody);
    callback(response.jsonBody);
  }).catch(e => {
    console.log(e);
    callback(e);
  })
}



function rewrite_card(UUID,card_id,title,date,star,feeling,location,tags,comments,allergens,callback){ 
  //Regenerates HTML for card, deletes existing data, and recreates updated data.
  var emotion_to_submit=[feeling,0.00];
  var tag=tags.replace(/\s/g,'');
  var description=[title,tag];
  var stars="";
  var html_text_to_submit="";
  var coordinates=[];
  var UK_formatted_date=date.substring(8,10)+"/"+date.substring(5,7)+"/"+date.substring(0,4);
  star_to_html(star,function(res_2){
    stars=res_2;
    reverse_geocoder(location,function(res){
      if(res!="ERROR"){
        coordinates=res;
        card_content(card_id,description,UK_formatted_date,stars,emotion_to_submit,location,comments,allergens,function(res){
          if(res!="ERROR"){
            html_text_to_submit=res;
            console.log(res);
            //data=[uuid,card_id,title,date,stars,tags,coordinates]
            var data=[UUID,card_id,title,date,star,tags,coordinates,location,allergens];
            insert_mysql(UUID,data,function(res){
              if(res=="ERROR"){
                callback("ERROR");
              }else{
                console.log("SQL INSERTION SUCCESSFUL");
              }
            });

            blobSvc.createBlockBlobFromText(UUID,card_id+"_txt",html_text_to_submit,function(err,result){
              if(err){
                callback("ERROR");
              }
              else if(!err){
                console.log("BLOB RECREATION SUCCESSFUL");
                callback("SUCCESS");
              }
            });
          }
          else{
            callback("ERROR");
          }
        });
      }else{
        callback("INVALID ADDRESS");
      }
    });
  });
  
  
  blobSvc.deleteBlobIfExists(UUID,card_id+"_txt",function(err,result){
    if(err){
      callback("ERROR");
    }
    else{
      console.log("DELETED THE BLOB");
    }
  });
  var sql_query="DELETE FROM food.food WHERE user='"+UUID.toString()+"' AND card_id='"+card_id+"';";
  general_SQL(sql_query,function(res){
    if(res=="SQL ERROR"){
      callback("ERROR");
    }else{
      console.log("DELETED THE SQL ENTRY");
    }
  });
  
  
  
}



function azure_image(image_food,callback){
  //This function processes the Vision API calls.
  var subscriptionKey = "YOUR-VISION-API-KEY";
  var uriBase = "https://westcentralus.api.cognitive.microsoft.com/vision/v1.0/analyze";
  fs.readFile(image_food,function(err,data){
  ms_vision.analyzeImage({
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "request-origin":"westcentralus",
    "type":"vision",
    "visual-features":"Categories,Description,Tags,Faces",
    "content-type": "application/octet-stream",
    "body": data
  }).then((result)=>{
    var tags=result["description"]["tags"];
    var description=[];
    description.push(result["description"]["captions"][0]["text"]);
    description.push(tags);
    console.log(description);
    callback(description);

  
  }).catch((err)=>{
    throw err;
  })
});
  



}

function reverse_geocoder(address,callback){
  //This is actuablly geocoding function, but for this application, it has been interpreted in an opposite meaning.
  geocoder.geocode(address, function(err, res) {
    if(!err){
      callback([res[0]["latitude"],res[0]["longitude"]]);
    }else if(err){
      callback("ERROR");
    }
  });
}

function azure__emotion(image_face,callback){
  //This function handles FACE API calls.
  var subscriptionKey = "YOUR-FACE-API-KEY";
  var uriBase = "westcentralus.api.cognitive.microsoft.com";
  var headers={
    "Content-type":"application/octet-stream"
  };
  fs.readFile(image_face,function(err,data){
  var emotion_client=new ms_emotion.face({
    apiKey:subscriptionKey,
    endpoint: uriBase
  });
  var body = data;
  var parameters={
    "returnFaceId": "false",
    "returnFaceLandmarks": "false",
    "returnFaceAttributes":"emotion"};
  console.log("emotion started");
  emotion_client.detect({
    parameters,
    headers,
    body
  }).then((response)=>{
    var emotion_score_pair=response[0]["faceAttributes"]["emotion"];
    var max=0;
    var max_prop="";
    for(var prop in emotion_score_pair) {
        if(emotion_score_pair[prop]>max){
          max=emotion_score_pair[prop];
          max_prop=prop;
        }
    }
    switch(max_prop){
      case "happiness":
         max_prop="😀";
         break;
      case "anger":
         max_prop="😠";
         break;
      case "contempt":
         max_prop="🤬";
         break;
      case "disgust":
         max_prop="🤮";
         break;
      case "fear":
         max_prop="😨";
         break;
      case "neutral":
         max_prop="😐";
         break;
      case "sadness":
         max_prop="😭";
         break;
      case "surprise":
         max_prop="🤭";
         break;
      default:
         max_prop="?";
         break;
    }
    var values=[];
    values.push(max_prop);
    values.push(max);
    console.log(values);
    callback(values);
  });
  console.log(" ");
});

}
function real_coordinates(LA_REF,LAT,LO_REF,LONG,callback){
  //This function coverts coordinates in hours, minutes, seconds form into double number.
  var real_LAT;
  var real_LONG;
  if(LAT!=undefined){
    var real_LAT=LAT[0]+LAT[1]/60+LAT[2]/3600;
    if(LA_REF=="S"){
      real_LAT*=(-1);
    }
    var real_LONG=LONG[0]+LONG[1]/60+LONG[2]/3600;
    if(LO_REF=="W"){
      real_LONG*=(-1);
    }
  }else{
    real_LAT=51.523856;
    real_LONG=-0.131636;
  }
  callback([real_LAT,real_LONG]);
  
}

function general_SQL(query_requested,callback){
  //This function processes all kinds of SQL queries.

  connection.query(
    query_requested,
    function(err, results, fields) {
      if(err){
        console.log(err);
        console.log("SQL ERROR");
        callback("SQL ERROR");
      }else{
        console.log("SQL SUCCESS");
        callback(results);
      }
    });
}


function geocoding(LA_REF,LAT,LO_REF,LONG,callback){ //This function determines the address corresponds to the coordinate.
  //This function is actually a reverse geocoder.
  var real_LAT="";
  var real_LONG="";
  real_coordinates(LA_REF,LAT,LO_REF,LONG,function(res){
    real_LAT=res[0];
    real_LONG=res[1];
  })
  geocoder.reverse({lat:real_LAT,lon:real_LONG},function(err,res){
    callback(res[0]["formattedAddress"]);
  });

}


function exif_data(filename,callback){
  //This function extracts meta data from the image. Only supports JPEG.
  console.log("RECEIVED FILE NAME",filename);
  try {
    new ExifImage({ image : filename.toString() }, function (error, exifData) {
        if (error){
            console.log('Error: '+error.message);
            var fake_data={"exif":{"CreateDate":new Date().toISOString()}, "gps":{"GPSLatitudeRef":"N","GPSLatitude":[51,30,30],"GPSLongitudeRef":"W","GPSLongitude":[0,0,0]}};
            callback(fake_data);
        }
        else{
            console.log(exifData); 
            callback(exifData);
        }
    });
} catch (error) {
    console.log('Error caught: ' + error.message);
    multi_threading+=1;
}

}

function emotion_star_relation(emotion,prob,callback){ //Generates html code for star ratings.
  var star_number=0;
  
  if(emotion=="😀"||emotion=="🤭"){
    if(prob>0.8){
      star_number=5;
    }
    else{
      star_number=4;
    }
  }else if (emotion=="😐") {
    star_number=3;
  }
  else if (emotion=="😠"||emotion=="😭") {
    star_number=2;
  }
  else if (emotion=="🤬"||emotion=="😨") {
    star_number=1;
  }
  else if (emotion=="🤮") {
    star_number=0
  }
  else{
    console.log("Unexpected error");
    star_number=8;
  }
  callback(star_number);
}
  
function star_to_html(star_number,callback){
  //Generates HTML text from star rating in a number form.
  var star_text="";
  if(star_number==8){
    star_text="<span>ERROR</span>";
  }else{
    for(var i=0;i<star_number;i++){
      star_text+="<span class='fa fa-star' style='color: orange;'></span>";
    }
    for(var i=(5-star_number);i>0;i--){
      star_text+="<span class='fa fa-star'></span>"
    }
  }
  callback(star_text);
}

function insert_mysql(uuid,data,callback){
  //data=[uuid,card_id,title,date,stars,tags,coordinates,location]
  //This SQL function is dedicated only for the SQL insert for the inputted data.
  sql_query_text="INSERT INTO food.food(user,card_id,title,date,star,tags,latitude,longitude,address,allergens) VALUES ('"+data[0].toString()+"','"+data[1].toString()+"','"+data[2].toString()+"','"+data[3].toString()+"','"+data[4].toString()+"','"+data[5].toString()+"',"+data[6][0].toString()+","+data[6][1].toString()+",'"+data[7]+"','"+data[8]+"');"
  console.log(sql_query_text);
  general_SQL(sql_query_text,function(res){
    if(res=="SQL ERROR"){
      console.log("SQL ERROR_INSERT");
      callback("ERROR");
    }else{
      callback("SUCCESS");
    }
  });

  

}

function card_content(card_id,description,UK_formatted_date,stars,emotion,location,comment,allergens,callback){
  var resulting_html="";
    resulting_html+='<div class="uk-visible-toggle"><div class="uk-card uk-card-default uk-grid-collapse uk-child-width-1-2@s uk-margin" uk-grid><div class="uk-card-media-left uk-cover-container">';
    resulting_html+='<img id="'+card_id+'" alt="" uk-cover>';
    resulting_html+='<canvas width="600" height="400"></canvas></div><div><div class="uk-card-body"><h3 class="uk-card-title">';
    resulting_html+=description[0].toUpperCase();
    resulting_html+='</h3>'+UK_formatted_date;
    resulting_html+=stars;
    resulting_html+=('<p>Feeling: '+emotion[0]+"<br></br>Location: "+location+"<br></br>Tags: ");
    resulting_html+= description[1];
    if(comment==""){
      resulting_html+="<br></br>Comments: No added comments.";
    }else{
      resulting_html+="<br></br>Comments: "+comment;
    }
    if(allergens!=""){
      resulting_html+="<br></br>Allergens: "+allergens;
    }
    resulting_html+='<p></p><ul class="uk-hidden-hover uk-iconnav">';
    resulting_html+='<li><a uk-icon="icon: pencil" onclick="edit_card(`'+card_id.toString()+'`);"></a></li>';
    resulting_html+='<li><a uk-icon="icon: copy" onclick="copy_card(`'+card_id.toString()+'`);"></a></li>';
    resulting_html+='<li><a uk-icon="icon: trash" onclick="delete_card(`'+card_id.toString()+'`);"></a></li>';
    resulting_html+="</ul></div></div></div></div><p2></p2>";
    callback(resulting_html);
    

}




function card_generator(card_id,description,emotion,exif_meta,callback){
  var location="";
  var time=exif_meta["exif"]["CreateDate"];
  var UK_formatted_date=time.substring(8,10)+"/"+time.substring(5,7)+"/"+time.substring(0,4);
  var stars="";
  emotion_star_relation(emotion[0],emotion[1],function(res){
    star_to_html(res,function(res_2){
      stars=res_2;
    });
  });
  var emoji=emotion[0];
  console.log(UK_formatted_date);
  geocoding(exif_meta["gps"]["GPSLatitudeRef"],exif_meta["gps"]["GPSLatitude"],exif_meta["gps"]["GPSLongitudeRef"],exif_meta["gps"]["GPSLongitude"],function(res){
    var location=res;
    console.log(location);
    description[1]=description[1].join(', ');
    card_content(card_id,description,UK_formatted_date,stars,emotion,location,"","",function(res){
      if(res!="ERROR"){
        callback([res,location]);

      }else{
        callback("ERROR");
      }

    });

    
    
    
  });
  



  
}


function image_resizer(filename,callback){
  console.log("resizer");
  fs.createReadStream(path.join(basedir,filename))
  .pipe(new JPEGDecoder)
  .pipe(resize({ width: 500, height: 500, fit: true }))
  .pipe(new JPEGEncoder)
  .pipe(fs.createWriteStream(path.join(basedir,filename+"_final")))
  .on('finish',function(){callback("SUCCESS");});
  

}

function download(url,filename,TOKEN,source,callback){
  if(source=='g'){ //url here is a file id.
    g_url(TOKEN,url,function(err,res,body,par2){ //Gets downloadUrl
      console.log(JSON.parse(body)["downloadUrl"]);
      request_({  //Authenticates and gets the file stream.
        headers:{
          'Authorization' : 'Bearer ' + TOKEN
        },
        uri: JSON.parse(body)["downloadUrl"],
        method: 'GET'
      }).pipe(fs.createWriteStream(path.join(basedir,filename))).on('close',callback);

    });

  }
  else
  {
    //Generic download from url (Includes Dropbox,OneDrive operation.)
    //Impossible to be called, but remained to prevent any errors.
    request_.head(url,function(err,res,body){ 
    var content_type=res.headers['content-type'];
    console.log('content-type:',content_type);
    console.log('content-length:',res.headers['content-length']);
    request_(url).pipe(fs.createWriteStream(path.join(basedir,filename))).on('close',callback);
    
  });
  
}

}



function g_url(token, fileId,callback) { //obtains downloadUrl for the Google Drive contents.
  googleDrive(token).files(fileId).get(callback)
}





function data_processor(UUID,image_food,image_face,TOKEN,source,callback){  //This function generates a card.
  var date=new Date();
  var card_id=date.getTime().toString()+(Math.floor(100000+Math.random()*900000)).toString(); //current time and the 6 digit random number.
  //Temporarily download the image
  
  download(image_face,card_id+"_face",TOKEN,source,function(err,res)
        {
          if(!err){
          console.log("Download face success");
          image_resizer(card_id+"_face",function(res){
            console.log(res);
            azure__emotion(path.join(basedir,card_id+"_face_final"),function(res){
              emotion=res;
            });
          });
          
          }
          else{
            console.log("Download face error");
            callback("download error");

          }
  download(image_food,card_id,TOKEN,source,function(err,res){
    if(!err){
    console.log('Download success');
    image_resizer(card_id,function(res){
      console.log(res);
      azure_image(path.join(basedir,card_id+"_final"),function(res){
        description=res
        blobSvc.createContainerIfNotExists(UUID, function(error, result, response){
          if(!error){
            console.log("Container created.");
            
            
            console.log("2");
            blobSvc.createBlockBlobFromLocalFile(UUID, card_id, path.join(basedir,card_id),function(error, result, response){
            console.log("preparing to upload");
            console.log("file name:",card_id);
            if(!error){
               console.log("file uploaded");
               var exif_meta="";
               exif_data(path.join(basedir,card_id),function(res){
                exif_meta=res;
                console.log(exif_meta)
                console.log(exif_meta["exif"]["CreateDate"]);
              
               
                 card_generator(card_id,description,emotion,exif_meta,function(res_1){
                   console.log(res_1);
                   var text_for_upload=res_1[0];
                   var location=res_1[1];
                   var text_for_index=[];
                   text_for_index.push(UUID);
                   text_for_index.push(card_id);
                   text_for_index.push(description[0]);
                   text_for_index.push(exif_meta["exif"]["CreateDate"]);
                   var stars=0;
                   emotion_star_relation(emotion[0],emotion[1],function(res_2){
                       stars=res_2;
                       text_for_index.push(stars);
                      text_for_index.push(description[1]);
                    });
                    var real_coor=[];
                    real_coordinates(exif_meta["gps"]["GPSLatitudeRef"],exif_meta["gps"]["GPSLatitude"],exif_meta["gps"]["GPSLongitudeRef"],exif_meta["gps"]["GPSLongitude"],function(res_coor){
                      real_coor=res_coor;
                      text_for_index.push(real_coor);
                      text_for_index.push(location);
                    });
                   blobSvc.createBlockBlobFromText(UUID, (card_id+"_txt"),text_for_upload, function(error, result, response){
                    if(!error){
                       console.log("Card upload has been finished.")
                       console.log(result);
                       //Delete downloaded files
                       fs.unlinkSync(path.join(basedir,card_id));
                       fs.unlinkSync(path.join(basedir,card_id+"_face"));
                       fs.unlinkSync(path.join(basedir,card_id+"_final"));
                       fs.unlinkSync(path.join(basedir,card_id+"_face"+"_final"));
                       text_for_index.push("NONE");
                       insert_mysql(UUID,text_for_index,function(res){
                         if(res=="ERROR"){
                           callback("ERROR");
                         }else{
                           console.log("SQL success");
                           callback(card_id);
                         }
                       });
                    }else{
                      console.log(error);
                      callback("general error 2");
                    }
                  });
                });
                 });
                  
              
              }
               
                
            console.log(error);
            console.log("Result");
            console.log(result);
            
            
            });
            
            
          }else{
            console.log("Error");
            callback("general error 3");
          }
          //console.log(result.created);
        });
      });
      
    });
    
    }
    else{
      console.log("Download error");
      callback("download error");
    }
    
    
    
  });
});

 
  console.log("1");
}

module.exports = app;
