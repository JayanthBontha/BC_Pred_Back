const express = require('express');
const mongoose = require('mongoose');
const path = require('path')
const cors = require('cors');
const parser = require('body-parser');
const app = express();
const User = require('./schemas/User');
const Sesh = require('./schemas/Security');
const otp = require('./schemas/Temp');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const AWS = require('aws-sdk');
const creds = new AWS.SharedIniFileCredentials({ profile: 'default' });
const SNS = new AWS.SNS({ creds, region: 'ap-south-1' });
app.use(parser.json());
app.use(cors());
mongoose.set('strictQuery', false);
mongoose.connect(process.env.CONNECTION_STRING, { useNewUrlParser: true });


let transporter = nodemailer.createTransport({
    service:'gmail',
    auth: {
        user: 'bc.predict@gmail.com',
        pass: 'xqfrpccrckwgcipp'
    },
    tls:{
        rejectUnauthorized:false
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


app.post('/login', (req, res) => {
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
    else{
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

app.post('/signUp', (req, res) => {
    if (is_Email(req.body.email_phone)) {
        // User.exists({ email: req.body.email_phone }).then(boule => {
        //     if (boule == null) {
        //         const new_pass = generateRandomNumber();
        //         let transporter = nodemailer.createTransport({
        //             host: 'smtp.elasticemail.com',
        //             port: 2525,
        //             secure: false,
        //             auth: {
        //                 user: 'goglepixstoar@gmail.com',
        //                 pass: '12EFEA58156C713AD256A110518A89636C02'
        //             }
        //         });

        //         let mailOptions = {
        //             from: '"Breast Cancer Prediction" <goglepixstoar@gmail.com>',
        //             to: req.body.email_phone,
        //             subject: 'Account Creation',
        //             text: "You have recently created an account with us.\nYour Verification OTP is " + new_pass + "\nIf you haven't made an account please contact site administrator."
        //         };

        //         transporter.sendMail(mailOptions, (error, info) => {
        //             if (error) {
        //                 console.log(error);
        //                 res.json({ code: 'wrong_email' })
        //             }
        //             else {
        //                 otp.create({ email: req.body.email_phone, otp: new_pass, flag: false, name: req.body.name, insti: req.body.insti, role: req.body.role }).then(val => {
        //                     res.json({ code: 'successful_email', temp: val._id });
        //                 });
        //             }
        //         })
        //     }

        //     else {
        //         return res.json({ code: "email_exists" });
        //     }
        // });
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
                        otp.create({ email: req.body.email_phone, otp: new_pass, flag: false, name: req.body.name, insti: req.body.insti, role: req.body.role }).then(val => {
                            res.json({ code: 'successful_email', temp: val._id });
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
                    } else {
                        otp.create({ phone: req.body.email_phone, otp: new_pass, flag: false, name: req.body.name, insti: req.body.insti, role: req.body.role }).then(val => {
                            res.json({ code: 'successful_phone', temp: val._id });
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

app.post('/verify', (req, res) => {
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

app.post('/last', (req, res) => {
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






app.post('/logout', (req, res) => {
    Sesh.deleteOne({ _id: req.body.mfa });
});

app.post('/changePass', async (req, res) => {
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

app.post('/resetPass', async (req, res) => {
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

app.listen(3001);