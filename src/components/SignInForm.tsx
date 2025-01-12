import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface SignInFormProps {
    setSignedInUser: (user: any) => void;
}

function SignInForm({ setSignedInUser }: SignInFormProps) {
    const [passwordStatus, setPasswordStatus] = useState<string>("");
    const [emailStatus, setEmailStatus] = useState<string>("");
    const [emailValid, setEmailValid] = useState<boolean>(true);
    const navigate = useNavigate();


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
            // add signedInUser to cookie
            document.cookie = `user=${encodeURIComponent(JSON.stringify(newUserInfo))}; path=/; max-age=43200`;

            // Navigate to the home page
            navigate('/');
        }
    }

    // FIXME: When the user logs in, we need their ID to be stored in a state and we need the home page to reflect their login. 
    async function checkLoginPassword(userInfo: { email: string; password: string }) {
        console.log('Checking login password:', userInfo);
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
            console.log('Signed in user:', data);
            toast.success('Sign in successful!');
            setEmailStatus('');

            // Store user ID in a state or context
            const userId = data.id;
            console.log('User ID:', userId);

            // Optionally, store user ID in local storage or cookies
            document.cookie = `user=${encodeURIComponent(JSON.stringify(data))}; path=/; max-age=43200`;

            // Navigate to the home page
            navigate('/');
          } else {
            toast.error('Sign in failed. Please check your credentials.');
          }
        } catch (error) {
          toast.error('Failed to sign in');
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