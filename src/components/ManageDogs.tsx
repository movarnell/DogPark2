import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { HumanType } from '../types/HumanType';

type DogType = {
  id: number;
  name: string;
  ownerId: number;
};

function ManageDogs({ signedInUser }: { signedInUser: HumanType }) {
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [dogName, setDogName] = useState('');

  useEffect(() => {
    async function fetchDogs() {
      try {
        const res = await fetch('https://backend.michaelvarnell.com:4050/api/dogs', {
          credentials: 'include'
        });
        const data = await res.json();
        setDogs(data);
      } catch {
        toast.error('Failed to fetch dogs');
      }
    }
    fetchDogs();
  }, []);

  async function handleAddDog(e: any) {
    e.preventDefault();
    try {
      const res = await fetch('https://backend.michaelvarnell.com:4050/api/dogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: dogName, ownerId: signedInUser.id }),
      });
      const newDog = await res.json();
      setDogs([...dogs, newDog]);
      setDogName('');
      toast.success('Dog added successfully');
    } catch {
      toast.error('Failed to add dog');
    }
  }

  async function handleRemoveDog(id: number) {
    try {
      const res = await fetch(`https://backend.michaelvarnell.com:4050/api/dogs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Dog removed');
        setDogs(dogs.filter(d => d.id !== id));
      } else {
        toast.error('Error removing dog');
      }
    } catch {
      toast.error('Server error');
    }
  }

  return (
    <div className="container mx-auto my-8">
      <h1 className="mb-4 text-2xl font-bold">Manage Dogs</h1>
      <ul>
        {dogs.map(dog => (
          <li key={dog.id} className="flex items-center justify-between mb-2">
            <span>{dog.name}</span>
            <button
              className="px-2 py-1 text-white bg-red-600 rounded"
              onClick={() => handleRemoveDog(dog.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddDog} className="mt-4">
        <input
          value={dogName}
          onChange={e => setDogName(e.target.value)}
          type="text"
          placeholder="New Dog Name"
          className="p-2 mr-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-600 rounded"
        >
          Add Dog
        </button>
      </form>
    </div>
  );
}

export default ManageDogs;
