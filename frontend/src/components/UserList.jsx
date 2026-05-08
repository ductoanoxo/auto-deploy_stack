import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, UserPlus, Mail, User as UserIcon, Loader2, Edit2, X, Check } from 'lucide-react';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', email: '', full_name: '' });
    const [editingUserId, setEditingUserId] = useState(null);
    const [editUserData, setEditUserData] = useState({ username: '', email: '', full_name: '' });
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState(null);

    // Tự động lấy IP/Domain của server hiện tại, mặc định dùng port 8000 cho API
    const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/users`);
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAdding(true);
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to add user');
            }
            const addedUser = await response.json();
            setUsers([...users, addedUser]);
            setNewUser({ username: '', email: '', full_name: '' });
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteUser = async (id) => {
        try {
            const response = await fetch(`${API_URL}/users/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete user');
            setUsers(users.filter(u => u.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    const startEditing = (user) => {
        setEditingUserId(user.id);
        setEditUserData({ username: user.username, email: user.email, full_name: user.full_name });
    };

    const cancelEditing = () => {
        setEditingUserId(null);
        setEditUserData({ username: '', email: '', full_name: '' });
    };

    const handleUpdateUser = async (id) => {
        setUpdating(true);
        try {
            const response = await fetch(`${API_URL}/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editUserData),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to update user');
            }
            const updatedUser = await response.json();
            setUsers(users.map(u => (u.id === id ? updatedUser : u)));
            cancelEditing();
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="item-list-container">
            <div className="item-list-header">
                <h3 className="item-list-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserIcon size={18} color="var(--c-green)" />
                    User Management
                </h3>
                {error && (
                    <div className="error-text">
                        {error}
                    </div>
                )}
            </div>

            <form onSubmit={handleAddUser} className="user-form">
                <div className="user-input-group">
                    <UserIcon size={16} />
                    <input
                        type="text"
                        placeholder="Username"
                        value={newUser.username}
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        required
                    />
                </div>
                <div className="user-input-group">
                    <Mail size={16} />
                    <input
                        type="email"
                        placeholder="Email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                    />
                </div>
                <div className="user-input-group">
                    <UserIcon size={16} />
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={newUser.full_name}
                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={adding}
                    className="btn-add-user"
                >
                    {adding ? <Loader2 size={16} className="loading-spinner" /> : <UserPlus size={16} />}
                    Add User
                </button>
            </form>

            <div style={{ overflowX: 'auto' }}>
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>Full Name</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence mode='popLayout'>
                            {loading ? (
                                <tr key="loading">
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '32px' }}>
                                        <Loader2 size={24} className="loading-spinner" style={{ margin: 'auto' }} />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr key="empty">
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.4)' }}>
                                        No users found. Start by adding one above.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <motion.tr 
                                        key={user.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        {editingUserId === user.id ? (
                                                <>
                                                    <td>
                                                        <input 
                                                            className="inline-edit-input" 
                                                            value={editUserData.full_name} 
                                                            onChange={(e) => setEditUserData({...editUserData, full_name: e.target.value})} 
                                                        />
                                                    </td>
                                                    <td>
                                                        <input 
                                                            className="inline-edit-input" 
                                                            value={editUserData.username} 
                                                            onChange={(e) => setEditUserData({...editUserData, username: e.target.value})} 
                                                        />
                                                    </td>
                                                    <td>
                                                        <input 
                                                            className="inline-edit-input" 
                                                            value={editUserData.email} 
                                                            onChange={(e) => setEditUserData({...editUserData, email: e.target.value})} 
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button 
                                                            disabled={updating}
                                                            onClick={() => handleUpdateUser(user.id)}
                                                            className="user-action-btn save"
                                                            title="Save"
                                                        >
                                                            {updating ? <Loader2 size={16} className="loading-spinner" /> : <Check size={16} />}
                                                        </button>
                                                        <button 
                                                            onClick={cancelEditing}
                                                            className="user-action-btn"
                                                            title="Cancel"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ fontWeight: 500, color: 'var(--c-white)' }}>{user.full_name}</td>
                                                    <td>@{user.username}</td>
                                                    <td>{user.email}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button 
                                                            onClick={() => startEditing(user)}
                                                            className="user-action-btn"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="user-action-btn delete"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
        </div>
    );
};

export default UserList;
