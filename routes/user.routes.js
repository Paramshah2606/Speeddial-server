const User = require('../models/User.js');
const { generateCallingNumber } = require('../utils/generateCallingNumber.js');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const registerUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user=await User.findOne({where:{username}});
    if(user){
      return res.status(400).json({error:"This username is taken"});
    }

    let callingNumber = generateCallingNumber();

    while(true){
      const numberExists=await User.findOne({where:{callingNumber}});
  
      if(numberExists){
        callingNumber = generateCallingNumber();
      }else{
        break;
      }
    }

    const hashed_password = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      username,
      callingNumber,
      password: hashed_password,  
    });

    res.json({
      status: 'success',
      user: newUser,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user=await User.findOne({where:{username}});
    if(!user){
      return res.status(400).json({error:"User not found"});
    }
    
    const passwordMatch=await bcrypt.compare(password,user.password);
    if(!passwordMatch){ 
      return res.status(400).json({error:"Invalid password"});
    }
    res.json({
      status: 'success',
      user: user,
    });
  } catch (err) {
    console.log("Errrorr",err);
    res.status(500).json({
      error: err.message,
    });
  }
};

module.exports = {
  registerUser,loginUser
};
