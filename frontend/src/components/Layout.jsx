import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ onRefresh, isRefreshing }) {
  return (
    <div className="app-shell">
      <Sidebar onRefresh={onRefresh} isRefreshing={isRefreshing} />
      <div className="main-area">
        <Topbar onRefresh={onRefresh} isRefreshing={isRefreshing} />
        <main className="content-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}