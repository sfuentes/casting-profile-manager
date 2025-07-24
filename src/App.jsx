import React, {useState} from 'react';
import {
    Calendar,
    User,
    Cloud,
    Settings,
    Bell,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    Clock,
    Users,
    ChevronRight,
    RefreshCw,
    Activity,
    Key,
    Link,
    Shield,
    AlertCircle,
    Camera,
    Image,
    Grid,
    Save,
    Loader
} from 'lucide-react';

// Import refactored components
import {AppProvider} from './context/AppContext';
import {Dashboard, CalendarView, ProfileView, PlatformsView, SyncIndicator, Button, Card, Badge, Modal, Input} from './components';

// Main App Component
const App = () => {
    const [currentView, setCurrentView] = useState('dashboard');

    const renderContent = () => {
        switch (currentView) {
            case 'dashboard':
                return <Dashboard/>;
            case 'calendar':
                return <CalendarView/>;
            case 'profile':
                return <ProfileView/>;
            case 'platforms':
                return <PlatformsView/>;
            case 'settings':
                return <SettingsView/>;
            default:
                return <Dashboard/>;
        }
    };

    return (
        <AppProvider>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-white shadow-sm border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center">
                                <h1 className="text-xl font-semibold text-gray-900">
                                    Darsteller Manager
                                </h1>
                            </div>
                            <div className="flex items-center space-x-4">
                                <SyncIndicator/>
                                <Bell className="w-6 h-6 text-gray-400 hover:text-gray-600 cursor-pointer"/>
                                <User className="w-8 h-8 text-gray-400 hover:text-gray-600 cursor-pointer"/>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex">
                    {/* Sidebar */}
                    <nav className="w-64 bg-white shadow-sm h-screen sticky top-0">
                        <div className="p-4">
                            <div className="space-y-1">
                                <SidebarItem
                                    icon={Activity}
                                    label="Dashboard"
                                    active={currentView === 'dashboard'}
                                    onClick={() => setCurrentView('dashboard')}
                                />
                                <SidebarItem
                                    icon={Calendar}
                                    label="Kalender"
                                    active={currentView === 'calendar'}
                                    onClick={() => setCurrentView('calendar')}
                                />
                                <SidebarItem
                                    icon={User}
                                    label="Profil"
                                    active={currentView === 'profile'}
                                    onClick={() => setCurrentView('profile')}
                                />
                                <SidebarItem
                                    icon={Cloud}
                                    label="Plattformen"
                                    active={currentView === 'platforms'}
                                    onClick={() => setCurrentView('platforms')}
                                />
                                <SidebarItem
                                    icon={Settings}
                                    label="Einstellungen"
                                    active={currentView === 'settings'}
                                    onClick={() => setCurrentView('settings')}
                                />
                            </div>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <main className="flex-1 p-8">
                        {renderContent()}
                    </main>
                </div>
            </div>
        </AppProvider>
    );
};

// Sidebar Item Component
const SidebarItem = ({icon: Icon, label, active, onClick}) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
            active
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
        }`}
    >
        <Icon className="w-5 h-5 mr-3"/>
        <span className="font-medium">{label}</span>
        {active && <ChevronRight className="w-4 h-4 ml-auto"/>}
    </button>
);

// Settings View Component (placeholder)
const SettingsView = () => (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
        <Card>
            <p className="text-gray-600">Settings view implementation goes here...</p>
        </Card>
    </div>
);

export default App;