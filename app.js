const express = require("express");
const app = express();
const path = require("path");
const fs = require('fs')
const os = require('os')
const multer  = require('multer')

// database
const Db = require('simple-mongo-client')
const DATABASE = 'Files'


// Middlewares
app.use(express.json());
app.set("view engine", "ejs");


// uploads
const FILES_DIR = path.join(os.homedir(),'KadMap-Graphics')
if(!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, FILES_DIR)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.originalname)
  }
})

const upload = multer({ storage })


// get / page
app.get("/", (req, res) => {
  try{
    const files= fs.readdirSync(FILES_DIR)
    console.log('loading',files.length,'files..')
    return res.render("index", {
      files: files.map(f=>({
        filename: f,
        ext: f.split('.').slice(-1)[0].toLowerCase(),
        isImage:  ['png','jpg','jpeg','gif'].includes(f.split('.').splice(-1)[0].toLowerCase())
      })),
      total: files.length
    });
  }catch(err){
    console.error(err)
    res.status(500).end()
  }
});

app.post("/upload",upload.single('file'), async(req, res) => {
  const filesDB = await Db.connect(DATABASE)
  const result = await filesDB.search({file:req.file.originalname})
  if(result.success && result.data.length<1){
    console.log('saving...',req.file.originalname)
    await filesDB.save({
      file:req.file.originalname,
      lastModified: Date.now()
    })
  } else{
    console.log('updating...',req.file.originalname)
    await filesDB.update({
      file:req.file.originalname
    },{
      lastModified: Date.now()
    })
  }
  res.redirect("/");

});

app.get("/files", async(req, res) => {
  const filesDB = await Db.connect(DATABASE)
  const [success,data] = await filesDB.getAll()
  return res.json(success?data:[]);
});

app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename
  res.sendFile(path.join(FILES_DIR,filename))
});

app.get("/thumbnail/:ext", (req, res) => {
  let file = path.join(__dirname,'static',req.params.ext+'.png')
  if(!fs.existsSync(file)) file=path.join(__dirname,'static','file.png')
  res.sendFile(file)
});

// files/del/:id
app.post("/files/del/:filename", async(req, res) => {
 try {
   console.log('deleting ',req.params.filename)
   // delete file
   const file = path.join(FILES_DIR,req.params.filename)
   if(fs.existsSync(file)){
     fs.unlinkSync(file)
     // delete db
     const filesDB = await Db.connect(DATABASE)
     filesDB.delete({file:req.params.filename})
     res.redirect('/')
   }
   else res.status(404).end()
 } catch (error) {
   console.error(error)
   res.status(500).end()
 }
});

const port = 5001;

app.listen(port, () => {
  console.log("server started on " + port);
});
