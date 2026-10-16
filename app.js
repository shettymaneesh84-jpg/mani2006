const express = require('express');
const {MongoClient, ObjectId, Binary} = require("mongodb");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended:true}));

const url = 'mongodb://shettymaneesh84_db_user:mani7164@ac-hz9ni5e-shard-00-00.hopqiv0.mongodb.net:27017,ac-hz9ni5e-shard-00-01.hopqiv0.mongodb.net:27017,ac-hz9ni5e-shard-00-02.hopqiv0.mongodb.net:27017/?ssl=true&replicaSet=atlas-lqc014-shard-0&authSource=admin'
const client = new MongoClient(url);

let users;

//setup the session
app.use(
    session({
        secret : "mani@7164",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

//store the image temp
const upload = multer({
    storage : multer.memoryStorage(),
    fileFilter: (request, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png"
        ];
        if(allowedTypes.includes(file.mimetype)){
            cb(null, true);
        }else{
            cb(new Error("ONly jpeg, jpg, png images are allowed!"));
        }
    }
});
function isLoggedIn(request,response,next){
    if(!request.session.userId){
        return response.redirect('/')
    }

}
app.get('/', (request, response) => {
    response.redirect("/login");
});

app.get('/login', (request, respose) => {
    respose.render("login",{
        error:null
    });
});

app.post("/login", async(request, response, next) => {
    try{
        const email = (request.body.email).trim().toLowerCase();
        const password = request.body.password;

        const user = await users.findOne({email});
        if(!user || !(await bcrypt.compare(password, user.password))){
            return response.render("login",{
                error:"Invalid credentials!!"
            });
        }

        //session creation
        request.session.regenerate((err)=>{
            if(err)
                return next(err);
            request.session.userId = user._id.toString();
            response.redirect("/home");
        })
    }catch(err){
        next(err);
    }
});

app.get('/signup', (request, respose) => {
    respose.render("register",{
        error:null
    });
});

app.post('/signup', upload.single("profilePicture"), async(request, response, next)=>{
    try{
        const fullname = (request.body.fullname).trim();
        const email = (request.body.email).trim().toLowerCase();
        const password = request.body.password;

        const existing = await users.findOne({email});
        if(existing){
            return response.render("signup",{
                error: "user already exists!!"
            });
        }
        //hash password
        const hashedPwd = await bcrypt.hash(password,12);

        const result = await users.insertOne({
            fullname : fullname,
            email : email,
            password: hashedPwd,
            profilePicture : {
                data : new Binary(request.file.buffer),
                contentType: request.file.mimetype
            },
            createdAt: new Date()
        });

        request.session.userId = result.insertedId.toString();
        response.redirect('/home');
    }catch(error){
        if(error.code === 11000){
            return response.render("signup",{
                error: "email already exists"
            })
        }
    }
});

app.get('/home',isLoggedIn,async (request, response,next) => {
    try{

        const userId=request.session.userId;
        if(!ObjectId.isValid(userId)){
            request.session.destroy(()=>response.redirect('/'));
            return;
        };
        const user=await users.findOne({_id:new ObjectId
            (userId)},{
        projection:{
            fullname:1,
            email:1,
            createdAt:1}

        }
    
    );
        if(!user){
            request.session.destroy(()=>response.redirect('/'));
            return;
        }
        response.render("home",{
            user
        });

    }catch(err){
        next(err)
    }
    
});
app.get('/profile',isLoggedIn,async (request, response,next) => {
    try{
        const userId=request.session.userId;
        if(!ObjectId.isValid(userId)){
            return response.sendstatus(404);

    };
    const user=await users.findOne({_id:new ObjectId
        (userId)},{
    projection:{
        profilePicture:1,}});
        if(user ||user.profilePicture ){
            return response.sendstatus(404);

        }
        response.set("Content-Type",user.profilePicture.contentType);
        response.set("cache-control","private ,no-store");
        response.send(Buffer.from(user.profilePicture.data.buffer));
     } catch(err){
        next(err);}
});
       
app.get('/logout', (request, response) => {
    request.session.destroy(()=>{
        response.redirect('/');
    });
});

async function startServer(){
    await client.connect();
    const db = client.db("auth-demo");
    users = db.collection("users");

    await users.createIndex({email: 1},{unique:true});

    console.log("Cpnnected to mongodb atlas");

    app.listen(3000,()=>{
        console.log("running on port 3000");
    });
}

startServer();