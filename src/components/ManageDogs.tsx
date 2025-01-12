import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { HumanType } from '../types/HumanType';

type DogType = {
  id: number;
  ownerId: number;
  dog_name: string;
  isFriendly: boolean;
  isPuppy: boolean;
  size: string;
};

function ManageDogs({ signedInUser }: { signedInUser: HumanType }) {
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [dogName, setDogName] = useState('');
  const [is_friendly, setIs_Friendly] = useState(false);
  const [is_puppy, setIs_Puppy] = useState(false);
  const [dogSize, setDogSize] = useState('');


  // NOTE: This function filters the dogs to only show the dogs that belong to the signed in user

  async function fetchDogs() {
    try {
      const res = await fetch('https://backend.michaelvarnell.com:4050/api/dogs/', {

      });
      const data = await res.json();
      // sort to show only owners dogs
      console.log("Owners Dogs:", data);
      setDogs(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to fetch dogs');
    }
  }

  // get the dogs from page load
  useEffect(() => {
    fetchDogs();
  }, []);

  async function handleAddDog(e: any) {
    e.preventDefault();
    console.log("signedInUser:", signedInUser);
    console.log("Handle add dog triggered:", dogName, is_friendly, is_puppy, dogSize);
    try {
      const res = await fetch('https://backend.michaelvarnell.com:4050/api/dogs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerId: signedInUser.id,
          dog_name: dogName,
          is_friendly: is_friendly,
          is_puppy,
          size: dogSize,
        }),
      });
      const newDog = await res.json();
      setDogs([...dogs, newDog]);
      setDogName('');
      setIs_Friendly(false);
      setIs_Puppy(false);
      setDogSize('');
      toast.success('Dog added successfully');
    } catch {
      toast.error('Failed to add dog');
    }
  }

  //SECTION - Remove Dog
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
  //SECTION Remove Dog END

  return (
    <div className="container mx-auto my-8">
      <h1 className="mb-4 text-2xl font-bold">Manage Dogs</h1>
      <ul>
        {dogs && dogs.map(dog => (
          <li key={dog.id} className="flex items-center justify-between mb-2">
            <span>{dog.dog_name}</span>
            <button
              className="px-2 py-1 text-white bg-red-600 rounded"
              onClick={() => handleRemoveDog(dog.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddDog} className="flex flex-col p-4 mt-4 bg-gray-100 rounded">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <input
            value={dogName}
            onChange={e => setDogName(e.target.value)}
            type="text"
            placeholder="New Dog Name"
            className="p-2 border rounded"
          />
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={is_friendly}
              onChange={e => setIs_Friendly(e.target.checked)}
            />
            <span>Friendly?</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={is_puppy}
              onChange={e => setIs_Puppy(e.target.checked)}
            />
            <span>Puppy?</span>
          </label>
          <label className="flex items-center space-x-1">
            <select
              value={dogSize}
              onChange={e => setDogSize(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">Select size</option>
              <option value="small">Small (0-20lbs)</option>
              <option value="medium">Medium (20-40lbs)</option>
              <option value="large">Large (40+ lbs)</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-blue-600 rounded"
          onSubmit={handleAddDog}
        >
          Add Dog
        </button>
      </form>
    </div>
  );
}

export default ManageDogs;
