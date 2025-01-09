

import React, { useState } from 'react';
import { Dispatch, SetStateAction } from 'react';
import { HumanType } from '../types/HumanType';

interface SignInFormProps {
    signedInUser: HumanType | null;
    setSignedInUser: Dispatch<SetStateAction<HumanType | null>>;
}

function SignInForm({ setSignedInUser }: SignInFormProps) {
    const [passwordStatus, setPasswordStatus] = useState<string>("");
    const [emailStatus, setEmailStatus] = useState<string>("");
    const [emailValid, setEmailValid] = useState<boolean>(false);


    // Takes in the user info when clicked and validates, if the validation
    // passes then it will send the user info to the checkLoginPassword function
    // to check if the user info is correct with what is in the database
    function signInUser(e: any) {
        e.preventDefault();
        if(validatePassword(passwordStatus) && validateEmail(emailStatus)){
        let newUserInfo = {
            email: emailStatus,
            password: passwordStatus
        }
        checkLoginPassword(newUserInfo);
    }
    }

    async function checkLoginPassword(userInfo: { email: string; password: string }) {
        const response = await fetch('https://backend.michaelvarnell.com:4050/api/humans/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userInfo),
        });
        const data = await response.json();
        if (response.status === 200) {
            setSignedInUser(data);
        } else if (response.status === 401) {
            console.error('Invalid email or password');
        } else {
            console.error('An error occurred:', data.message);
        }
    }

    function validatePassword(password: string) {
        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,})/;
        if (!passwordRegex.test(password)) {
            console.log("Password does not meet requirements");
            return false;
        }
        else {
            console.log("Password meets requirements");
            setPasswordStatus(password);
            return true;
        }
    }

     function validateEmail(email: string) {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (emailRegex.test(email)) {
            console.log("Valid email");
            setEmailStatus(email);
            setEmailValid(true);
            return true;
        } else {
            console.log("Invalid email");
            setEmailValid(false);
            return false;
        }
    }

    return (
        <div>
            <div className="container flex items-center justify-center h-screen mx-auto">
            <form className="p-8 mx-auto my-auto bg-white rounded-lg shadow-md w-96 ">
            <h1 className='mb-3 mb-5 text-3xl'>Sign In</h1>
    <div className="mb-4">
        <input
            type="text"
            placeholder="Email"
            onChange={(e) => validateEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* FIXME: when the email is invalid, the error message should display but right now it is switched from a boolean to a string and therefore this logic is not working */}
        {emailValid ? null :<p className="mt-1 text-red-500">Invalid email</p>}
    </div>
    <div className="mb-4">
        <input
            type="password"
            placeholder="Password"
            onChange={(e) => validatePassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* FIXME: when the password is invalid, the error message should display but right now it is switched from a boolean to a string and therefore this logic is not working */}
        {passwordStatus ? <p className="mt-1 text-red-500">Password does not meet requirements</p> : null}
    </div>
    <button
        onClick={(e) => signInUser(e)}
        className="w-full py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
        Sign In
    </button>
</form>
            </div>
        </div>
    );
}

export default SignInForm;