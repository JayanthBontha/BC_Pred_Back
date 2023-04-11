const express = require('express');
const mongoose = require('mongoose');
const path = require('path')
const cors = require('cors');
const parser = require('body-parser');
const app = express();
const User = require('./schemas/User');
const Sesh = require('./schemas/Security');
const Image = require('./schemas/Image');
const otp = require('./schemas/Temp');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const AWS = require('aws-sdk');
const creds = new AWS.Credentials({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.PASS
});
const SNS = new AWS.SNS({ creds, region: 'ap-south-1' });
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const sharp = require('sharp');
const multer = require('multer');
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, './uploads/')
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname)
        }
    }),
    limits: {
        fileSize: 1024 * 1024 * 10
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});


app.use(parser.json());
app.use(cors());



mongoose.set('strictQuery', false);
mongoose.connect(process.env.CONNECTION_STRING, { useNewUrlParser: true });


const modelPath = './src/model/model.json';
const model = tf.loadLayersModel("file://" + modelPath);


let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bc.predict@gmail.com',
        pass: 'xqfrpccrckwgcipp'
    },
    tls: {
        rejectUnauthorized: false
    }
});


function check(request_ip, public_mfa) {
    return new Promise((resolve) => {
        if (public_mfa == null) {
            resolve(null);
        }
        Sesh.findById(public_mfa).then(val => {
            if (val == null) resolve(null);
            else if (((new Date()) - val.date) / 1000 / 60 > 15) {
                Sesh.findByIdAndDelete(public_mfa, (err, doc) => { if (err) console.log(err); });
                resolve(null);
            }
            else if (val.ip == request_ip) {
                Sesh.updateOne({ mfa: public_mfa }, { date: new Date() });
                resolve(val.user_id);
            }
            else {
                resolve(null);
            }
        }).catch(err => { console.log(err); resolve(null); });
    });
}

function generateRandomString() {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < 16; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function generateRandomNumber() {
    let result = '';
    let characters = '0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function is_Email(email_phone) {
    if (email_phone.includes('@')) return true;
    else return false;
}



app.post('/api/login', (req, res) => {
    if (is_Email(req.body.email_phone)) {
        User.exists({ email: req.body.email_phone }).then(boule => {
            if (boule) {
                User.find({ email: req.body.email_phone, pass: req.body.pass }).then(temp => {
                    if (temp.length == 0) {
                        return res.json({
                            auth: 0,
                            err: 'wrong_password'
                        });
                    }

                    else {
                        Sesh.create({ user_id: temp[0]._id, ip: req.ip, date: new Date() })
                            .then(val => {
                                return res.json({
                                    auth: 1,
                                    mfa: val._id,
                                    name: temp[0].name
                                })
                            });
                    }
                })
            }


            else
                return res.json({
                    auth: 0,
                    err: 'wrong_email'
                });
        });
    }
    else {
        User.exists({ phone: req.body.email_phone }).then(boule => {
            if (boule) {
                User.find({ phone: req.body.email_phone, pass: req.body.pass }).then(temp => {
                    if (temp.length == 0) {
                        return res.json({
                            auth: 0,
                            err: 'wrong_password'
                        });
                    }

                    else {
                        Sesh.create({ user_id: temp[0]._id, ip: req.ip, date: new Date() })
                            .then(val => {
                                return res.json({
                                    auth: 1,
                                    mfa: val._id,
                                    name: temp[0].name
                                })
                            });
                    }
                })
            }


            else
                return res.json({
                    auth: 0,
                    err: 'wrong_number'
                });
        });
    }
});

app.post('/api/signUp', (req, res) => {
    if (is_Email(req.body.email_phone)) {
        User.exists({ email: req.body.email_phone }).then(boule => {
            if (boule == null) {
                const new_pass = generateRandomNumber();

                let mailOptions = {
                    from: '"Breast Cancer Prediction" <bc.predict@gmail.com>',
                    to: req.body.email_phone,
                    subject: 'Account Creation',
                    text: "You have recently created an account with us.\nYour Verification OTP is " + new_pass + "\nIf you haven't made an account please contact site administrator."
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log(error);
                        res.json({ code: 'wrong_email' })
                    }
                    else {
                        otp.findOne({ email: req.body.email_phone }).then(does => {
                            if (does == null) {
                                otp.create({ email: req.body.email_phone, otp: new_pass, flag: false, name: req.body.name, insti: req.body.insti, role: req.body.role }).then(val => {
                                    res.json({ code: 'successful_email', temp: val._id });
                                });
                            }
                            else {
                                res.json({ code: 'otp_exists' })
                            }
                        });
                    }
                })
            }

            else {
                return res.json({ code: "email_exists" });
            }
        });
    }
    else {
        User.exists({ phone: req.body.email_phone }).then(boule => {
            if (boule == null) {
                new_pass = generateRandomNumber();
                const params = {
                    Message: 'Your OTP to login is ' + new_pass,
                    PhoneNumber: req.body.email_phone,
                    MessageAttributes: {
                        'AWS.SNS.SMS.SMSType': {
                            DataType: 'String',
                            StringValue: 'Transactional'
                        }
                    }
                };
                SNS.publish(params, (err, data) => {
                    if (err) {
                        return res.json({ code: "wrong_phone" });
                    }
                    else {
                        otp.findOne({ phone: req.body.email_phone }).then(does => {
                            if (does == null) {
                                otp.create({ phone: req.body.email_phone, otp: new_pass, flag: false, name: req.body.name, insti: req.body.insti, role: req.body.role }).then(val => {
                                    res.json({ code: 'successful_phone', temp: val._id });
                                });
                            }
                            else {
                                res.json({ code: 'otp_exists' })
                            }
                        });

                    }
                });
            }
            else {
                return res.json({ code: "phone_exists" });
            }
        })
    }
});

app.post('/api/verify', (req, res) => {
    otp.findById(req.body.temp).then(val => {
        if (val == null) {
            return res.json({ code: "wrong_otp" });
        }
        else {
            if (val.otp == req.body.otp) {
                val.flag = true;
                val.save();
                return res.json({ code: "successful_otp" });
            }
            else {
                return res.json({ code: "wrong_otp" });
            }
        }
    });

});

app.post('/api/last', (req, res) => {
    console.log("called")
    otp.findOne({ _id: req.body.temp }).then(val => {
        console.log(val);
        if (val.flag == true) {
            otp.findById(req.body.temp).then(val => {
                if (val.email != null) {
                    User.create({ email: val.email, name: val.name, insti: val.insti, role: val.role, pass: req.body.pass }).then(val1 => {
                        otp.deleteOne({ _id: req.body.temp }).catch(err => console.log(err));
                        return res.json({ code: "successful_signup" });
                    });
                }
                else {
                    User.create({ phone: val.phone, name: val.name, insti: val.insti, role: val.role, pass: req.body.pass }).then(val1 => {
                        otp.deleteOne({ _id: req.body.temp }).catch(err => console.log(err));
                        return res.json({ code: "successful_signup" });
                    });
                }
            });
        }
    });
});






app.post('/api/logout', (req, res) => {
    Sesh.deleteOne({ _id: req.body.mfa });
});

app.post('/api/changePass', async (req, res) => {
    usrid = await check(req.ip, req.body.mfa);
    const dat = await User.findById(usrid);
    if (usrid != null) {
        if (dat.pass === req.body.oldpass) {
            dat.pass = req.body.newpass;
            dat.save();
            res.json({ error: null });
        }
        else {
            res.json({ error: 1 });
        }
    }
    else {
        Sesh.deleteOne({ _id: req.body.mfa }).catch(err => console.log(err));
        res.json({ error: 2 });
    }
});

app.post('/api/resetPass', async (req, res) => {
    const data = await User.find({ email: req.body.email });
    if (data.length != 0) {
        const new_pass = generateRandomString();
        let transporter = nodemailer.createTransport({
            host: 'outlook.office365.com',
            port: 587,
            secure: false,
            auth: {
                user: 'university-research-portal@outlook.com',
                pass: 'HelloWork123$'
            }
        });

        let mailOptions = {
            from: '"Breast Cancer Prediction" <university-research-portal@outlook.com>',
            to: data[0].email,
            subject: 'Password Reset',
            text: "You have recently requested a password reset.\nYour new password is " + new_pass + "\nIf you haven't requested a password reset please contact site administrator."
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            else {
                data[0].pass = new_pass;
                data[0].save();
                res.json({ code: 1 })
            }
        });
    }
    else {
        res.json({ code: 2 });
    }
});


app.post('/api/malaria', upload.single('image'), async (req, res) => {
    usrid = await check(req.ip, req.body.mfa);
    if (usrid != null) {
        sharp(req.file.path)
            .resize(50, 50)
            .toBuffer()
            .then((data) => {
                const tensor = tf.node.decodeImage(data, 3);
                let reshapedTensor = tensor.reshape([1, 50, 50, 3]).div(255);
                model.then(mod => {
                    let ans = mod.predict(reshapedTensor).dataSync()[0];
                    const image = new Image({
                        added_by: req.body.mfa,
                        data: fs.readFileSync(req.file.path),
                        predicted_as: ans > 0.5 ? 1 : 0,
                        type: "image/" + req.file.path.split('.')[1]
                    });

                    image.save()
                        .then((savedImage) => {
                            console.log("Image saved with ID: ", savedImage._id);
                            res.json({ code: ans > 0.5 ? 1 : 0, id: savedImage._id });
                        })
                        .catch((error) => {
                            console.error("Error saving image: ", error);
                            res.json({ code: 3 });
                        });

                    fs.unlink(req.file.path, (err) => {
                        if (err)
                            console.error(`Error deleting file: ${err}`);
                    });
                })
                    .catch((err) => console.log(err));
            });
    }
    else {
        Sesh.deleteOne({ _id: req.body.mfa }).catch(err => console.log(err));
        res.json({ code: 2 });
    }

});

app.post('/api/malaria/ans', async (req, res) => {
    usrid = await check(req.ip, req.body.mfa);
    if (usrid != null) {
        Image.findOne({ _id: req.body.id }).then(val => {
            if (val != null) {
                val.user_ans = req.body.ans;
                val.save();
                res.json({ code: 1 });
            }
            else {
                res.json({ code: 2 });
            }
        });
    }
    else {
        res.json({ code: 0 });
    }
});

app.listen(3001, () => {
    console.log('Server is listening on port 3001');
});

// Image.findOne({ _id: '643506f69f5496c90491190d' }).then(image => {
//     fs.writeFile('./Back-End/example/' + generateRandomString() + '.' + image.type, image.data, (err) => {
//         if (err) {
//             console.log(err);
//             return;
//         }

//         console.log('Image saved!');
//     });
// });