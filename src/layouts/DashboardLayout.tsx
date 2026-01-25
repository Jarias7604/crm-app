import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';

export default function DashboardLayout() {
    return (
        <div className="min-h-screen bg-[#F1F3F9]">
            {/* Desktop Sidebar - Hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Mobile Bottom Nav - Hidden on desktop */}
            <MobileNav />

            {/* Main Content Area */}
            {/* Added pb-20 for mobile bottom nav spacing */}
            <div className="md:pl-64 flex flex-col min-h-screen transition-all duration-300 pb-20 md:pb-0">
                {/* Symmetric vertical spacing: 64px (pt-16) to ensure the card feels perfectly centered */}
                <main className="flex-1 w-full max-w-[1580px] mx-auto px-4 md:px-8 md:pt-16 md:pb-16">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
