import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface SignInFormProps {
    setSignedInUser: (user: any) => void;
}

function SignInForm({ setSignedInUser }: SignInFormProps) {
    const [passwordStatus, setPasswordStatus] = useState<string>("");
    const [emailStatus, setEmailStatus] = useState<string>("");
    const [emailValid, setEmailValid] = useState<boolean>(true);

    function validateEmail(email: string) {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (emailRegex.test(email)) {
            setEmailValid(true);
            return true;
        } else {
            setEmailValid(false);
            return false;
        }
    }

    function signInUser(e: any) {
        e.preventDefault();
        const isEmailValid = validateEmail(emailStatus);
        if (isEmailValid) {
            let newUserInfo = {
                email: emailStatus,
                password: passwordStatus
            }
            checkLoginPassword(newUserInfo);
        }
    }

    async function checkLoginPassword(userInfo: { email: string; password: string }) {
        try {
            const response = await fetch('https://backend.michaelvarnell.com:4050/api/owners/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userInfo),
            });
            const data = await response.json();
            if (response.status === 200) {
                setSignedInUser(data);
                toast.success('Sign in successful!');
                setEmailStatus('');
                setPasswordStatus('');
            } else if (response.status === 401) {
                toast.error('Invalid email or password');
            } else {
                toast.error(`An error occurred: ${data.message}`);
            }
        } catch (error) {
            toast.error('An error occurred while signing in');
        }
    }

    return (
        <div className="container flex items-center justify-center h-screen mx-auto">
            <form className="p-8 mx-auto my-auto bg-white rounded-lg shadow-md w-96" onSubmit={signInUser}>
                <h1 className='mb-5 text-3xl'>Sign In</h1>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Email"
                        value={emailStatus}
                        onChange={(e) => setEmailStatus(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {!emailValid && <p className="mt-1 text-red-500">Invalid email</p>}
                </div>
                <div className="mb-4">
                    <input
                        type="password"
                        placeholder="Password"
                        value={passwordStatus}
                        onChange={(e) => setPasswordStatus(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Sign In
                </button>
                <Link to="/register" className="block mt-3 text-center text-blue-500 hover:underline">New to the app? Register here</Link>
            </form>
            <ToastContainer />
        </div>
    );
}

export default SignInForm;