import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';

export default function DashboardLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Desktop Sidebar - Hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Mobile Bottom Nav - Hidden on desktop */}
            <MobileNav />

            {/* Main Content Area */}
            {/* Added pb-20 for mobile bottom nav spacing */}
            <div className="md:pl-64 flex flex-col min-h-screen transition-all duration-300 pb-20 md:pb-0">
                {/* Reduced padding on mobile */}
                <main className="flex-1 p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
