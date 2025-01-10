
import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function RegistrationForm() {
  const [humanName, setHumanName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister(e: any) {
    e.preventDefault();
    try {
      const response = await fetch('https://backend.michaelvarnell.com:4050/api/owners/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          human_name: humanName,
          email,
          username,
          password
        })
      });
      if (response.status === 201) {
        toast.success('Registration successful!');
        setHumanName('');
        setEmail('');
        setUsername('');
        setPassword('');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Registration failed');
      }
    } catch (error) {
      toast.error('An error occurred while registering');
    }
  }

  return (
    <div className="container flex items-center justify-center h-screen mx-auto">
      <form onSubmit={handleRegister} className="p-8 mx-auto my-auto bg-white rounded-lg shadow-md w-96">
        <h1 className="mb-5 text-3xl">Register</h1>
        <div className="mb-4">

          <input
            type="text"
            placeholder="Full Name"
            value={humanName}
            onChange={(e) => setHumanName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className='mb-4 text-xs text-gray-500'>Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character</p>
        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Register
        </button>
      </form>
      <ToastContainer />
    </div>
  );
}

export default RegistrationForm;