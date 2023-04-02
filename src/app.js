const express = require('express');
const mongoose = require('mongoose');
const path = require('path')
const cors = require('cors');
const parser = require('body-parser');
const app = express();
const User = require('./schemas/User');
const Sesh = require('./schemas/Security');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const nodemailer = require('nodemailer');

app.use(parser.json());
app.use(cors());
mongoose.set('strictQuery', false);


mongoose.connect(process.env.CONNECTION_STRING, { useNewUrlParser: true });


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



app.post('/login', (req, res) => {
    User.exists({ email: req.body.email }).then(boule => {
        if (boule) {
            User.find({ email: req.body.email, pass: req.body.pass }).then(temp => {
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
});

app.post('/signUp', (req, res) => {
    User.exists({ email: req.body.email }).then(boule => {
        if (boule == null) {
            User.create({ name: req.body.name, email: req.body.email, insti: req.body.insti, role: req.body.role, pass: req.body.pass })
                .then(val => {
                    Sesh.create({ user_id: val._id, ip: req.ip, date: new Date() })
                        .then(something => {
                            return res.json({ code: "successful", mfa: something._id });
                        })
                });
        }
        else {
            return res.json({ code: "exists" });
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
    else{
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