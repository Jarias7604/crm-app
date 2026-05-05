import { Globe, Twitter, Linkedin, Facebook, Youtube } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="bg-[#032D60] text-slate-300 py-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-16">
          
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-6 text-white">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Arias CRM</span>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              The #1 Agentic AI CRM. Humans with Agents drive customer success together.
            </p>
            <div className="flex items-center gap-4 text-white">
              <a href="#" className="hover:text-blue-400 transition-colors"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="hover:text-blue-400 transition-colors"><Linkedin className="w-5 h-5" /></a>
              <a href="#" className="hover:text-blue-400 transition-colors"><Facebook className="w-5 h-5" /></a>
              <a href="#" className="hover:text-blue-400 transition-colors"><Youtube className="w-5 h-5" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Products</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Sales Cloud</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Service Hub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Marketing Hub</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Commerce</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Data & Analytics</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Agentforce AI</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Solutions</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">By Industry</a></li>
              <li><a href="#" className="hover:text-white transition-colors">By Role</a></li>
              <li><a href="#" className="hover:text-white transition-colors">By Company Size</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Small Business</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Enterprise</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Learning Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Customer Stories</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Events & Webinars</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Developers</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Newsroom</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Investor Relations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <span>© {new Date().getFullYear()} Arias Defense El Salvador. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Legal</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Information</a>
            <a href="#" className="hover:text-white transition-colors">Responsible Disclosure</a>
            <a href="#" className="hover:text-white transition-colors">Trust</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
