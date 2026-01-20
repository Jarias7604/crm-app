import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className="pl-64 flex flex-col min-h-screen transition-all duration-300">
                <main className="flex-1 p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
