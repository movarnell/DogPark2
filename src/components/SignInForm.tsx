

import React, { useState } from 'react';
import { Dispatch, SetStateAction } from 'react';
import { HumanType } from '../types/HumanType';

interface SignInFormProps {
    signedInUser: HumanType | null;
    setSignedInUser: Dispatch<SetStateAction<HumanType | null>>;
}

function SignInForm({ setSignedInUser }: SignInFormProps) {
    const [passwordStatus, setPasswordStatus] = useState<boolean>(false);
    const [emailStatus, setEmailStatus] = useState<boolean>(false);


    function signInUser(e: any) {
        e.preventDefault();
        const email = e.target[0].value;
        const password = e.target[1].value;
        const user = { email, password };
        setSignedInUser(user);
    }

    function validatePassword(password: string) {
        const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,})/;
        if (!passwordRegex.test(password)) {
            console.log("Password does not meet requirements");
            setPasswordStatus(false);
        }
        else {
            console.log("Password meets requirements");
            setPasswordStatus(true);
        }
    }

    function validateEmail(email: string) {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
            console.log("Invalid email");
            setEmailStatus(false);
        }
        else {
            console.log("Valid email");
            setEmailStatus(true);
        }
    }

    return (
        <div>
            <h1>Sign In</h1>
            <form>
                <input type="text" placeholder="Email" onChange={(e) => validateEmail(e.target.value)} />
                {emailStatus ? <p className="text-red-500">Invalid email</p> : null}
                <input type="password" placeholder="Password" onChange={(e) => validatePassword(e.target.value)} />
                {passwordStatus ? <p className="text-red-500">Password does not meet requirements</p> : null}

                <button type="submit">Sign In</button>
            </form>
        </div>
    );
}

export default SignInForm;