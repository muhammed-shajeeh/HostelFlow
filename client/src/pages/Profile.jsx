import { useState, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useContext(AuthContext);

  if (!user) return <div className="p-10 text-center text-red-500">Error loading profile.</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <Link 
          to="/profile/edit" 
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Edit Profile
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {/* Header Section */}
        <div className="bg-gray-50 border-b p-6 flex items-center gap-6">
          <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center text-gray-500 text-3xl font-bold shadow-inner">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">{user.fullName}</h3>
            <p className="text-gray-500 font-medium">{user.role} • {user.approvalStatus}</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Personal Details */}
          <div>
            <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Personal Information</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500">Email Address</label>
                <div className="font-semibold text-gray-800">{user.email}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Admission / Employee Number</label>
                <div className="font-semibold text-gray-800">{user.admissionNumber || 'N/A'}</div>
              </div>
              {user.role === 'STUDENT' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500">Department</label>
                    <div className="font-semibold text-gray-800">{user.department || 'Not Provided'}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Year & Semester</label>
                    <div className="font-semibold text-gray-800">
                      Year {user.year || '-'} • Semester {user.semester || '-'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Additional Details */}
          <div>
            {user.role === 'STUDENT' && (
              <>
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Parent Details</h4>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-xs text-gray-500">Parent/Guardian Name</label>
                    <div className="font-semibold text-gray-800">{user.parentName || 'Not Provided'}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Parent Email</label>
                    <div className="font-semibold text-gray-800">{user.parentEmail || 'Not Provided'}</div>
                  </div>
                </div>
              </>
            )}

            <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Hostel Allocation</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500">Hostel</label>
                <div className="font-semibold text-gray-800">
                  {user.hostelId ? `${user.hostelId.name} (${user.hostelId.hostelCode})` : 'Unassigned'}
                </div>
              </div>
              {user.role === 'STUDENT' && (
                <div>
                  <label className="block text-xs text-gray-500">Room</label>
                  <div className="font-semibold text-gray-800">
                    {user.roomId ? `Room ${user.roomId.roomNumber} (Floor ${user.roomId.floor})` : 'Unassigned'}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
