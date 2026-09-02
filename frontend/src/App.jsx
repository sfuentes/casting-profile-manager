import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import {
    Calendar,
    User,
    Cloud,
    Settings,
    Bell,
    ChevronRight,
    Activity,
    LogOut
} from 'lucide-react';

// Import refactored components
import {AppProvider, useAppContext} from './context/AppContext';
import {Dashboard, CalendarView, ProfileView, PlatformsView, SyncIndicator, Card, Login, Register} from './components';

// Main App Component
const App = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

/** The five destinations, in the order the sidebar lists them. */
const VIEWS = [
    {id: 'dashboard', label: 'Dashboard', icon: Activity},
    {id: 'calendar', label: 'Kalender', icon: Calendar},
    {id: 'profile', label: 'Profil', icon: User},
    {id: 'platforms', label: 'Plattformen', icon: Cloud},
    {id: 'settings', label: 'Einstellungen', icon: Settings}
];

const AppContent = () => {
    const { user, isAuthenticated, loading, logout } = useAppContext();
    const [currentView, setCurrentView] = useState('dashboard');
    const [authView, setAuthView] = useState('login'); // 'login' or 'register'

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: '100vh', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.50'
                }}
            >
                <CircularProgress size={48}/>
            </Box>
        );
    }

    if (!isAuthenticated || !user) {
        return authView === 'login' ? (
            <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
            <Register onSwitchToLogin={() => setAuthView('login')} />
        );
    }

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
        <Box sx={{minHeight: '100vh', bgcolor: 'grey.50'}}>
            <AppBar position="static" color="inherit" elevation={1}>
                <Box sx={{maxWidth: 1280, width: '100%', mx: 'auto', px: {xs: 2, sm: 3, lg: 4}}}>
                    <Toolbar disableGutters sx={{justifyContent: 'space-between'}}>
                        <Typography variant="h6" fontWeight={600}>Darsteller Manager</Typography>

                        <Stack direction="row" gap={2} sx={{alignItems: 'center'}}>
                            <SyncIndicator/>
                            <Box sx={{color: 'text.disabled', display: 'flex'}}>
                                <Bell size={24}/>
                            </Box>
                            <Divider orientation="vertical" flexItem/>
                            <Stack direction="row" gap={1} sx={{alignItems: 'center'}}>
                                <Box sx={{color: 'text.disabled', display: 'flex'}}>
                                    <User size={24}/>
                                </Box>
                                <Typography variant="body2" fontWeight={500}>{user?.name}</Typography>
                                <IconButton
                                    onClick={logout}
                                    title="Abmelden"
                                    size="small"
                                    sx={{color: 'text.disabled', '&:hover': {color: 'error.main'}}}
                                >
                                    <LogOut size={20}/>
                                </IconButton>
                            </Stack>
                        </Stack>
                    </Toolbar>
                </Box>
            </AppBar>

            <Box sx={{display: 'flex'}}>
                <Box
                    component="nav"
                    sx={{
                        width: 256, flexShrink: 0, bgcolor: 'background.paper',
                        minHeight: '100vh', position: 'sticky', top: 0, boxShadow: 1
                    }}
                >
                    <List sx={{p: 1}}>
                        {VIEWS.map((view) => (
                            <SidebarItem
                                key={view.id}
                                icon={view.icon}
                                label={view.label}
                                active={currentView === view.id}
                                onClick={() => setCurrentView(view.id)}
                            />
                        ))}
                    </List>
                </Box>

                <Box component="main" sx={{flex: 1, p: 4, minWidth: 0}}>
                    {renderContent()}
                </Box>
            </Box>
        </Box>
    );
};

/**
 * One sidebar entry.
 *
 * Takes `props` whole rather than destructuring the icon: eslint here runs
 * without eslint-plugin-react, so it does not count a JSX tag as a use, and its
 * uppercase exemption covers variables but not parameters.
 */
const SidebarItem = (props) => (
    <ListItemButton
        onClick={props.onClick}
        selected={props.active}
        sx={{
            borderRadius: 2,
            mb: 0.5,
            ...(props.active && {
                borderRight: 2,
                borderColor: 'primary.dark',
                color: 'primary.dark'
            })
        }}
    >
        <ListItemIcon sx={{minWidth: 36, color: 'inherit'}}>
            <props.icon size={20}/>
        </ListItemIcon>
        <ListItemText
            primary={props.label}
            slotProps={{primary: {fontWeight: 500}}}
        />
        {props.active && <ChevronRight size={16}/>}
    </ListItemButton>
);

// Settings View Component (placeholder)
const SettingsView = () => (
    <Stack gap={3}>
        <Typography variant="h4" component="h1" fontWeight={700}>Einstellungen</Typography>
        <Card>
            <Typography color="text.secondary">Settings view implementation goes here...</Typography>
        </Card>
    </Stack>
);

export default App;
