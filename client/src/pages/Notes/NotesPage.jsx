import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import './NotesPage.css';

const NotesPage = () => {
    return (
        <div className="notes-page-layout">
            <Sidebar />
            <main className="notes-content">
                <Outlet />
            </main>
        </div>
    );
};

export default NotesPage; 