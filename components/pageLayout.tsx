import { AppBar, Avatar, BottomNavigation, BottomNavigationAction, Box, Container, IconButton, Toolbar, Typography } from '@mui/material';
import { AdminPanelSettings, ArrowBack, Brightness6, FoodBank, FormatListBulleted, Groups, Logout, QueryStats } from '@mui/icons-material';
import { ReactElement } from 'react';
import { invertTheme, useAppTheme } from '../lib/theme';
import { useRouter } from 'next/router';
import { getAuth, signOut } from 'firebase/auth';
import { useStaffUser } from '../lib/firestoreHooks';

type PageLayoutProps = {
  children: ReactElement,
  title: string,
  backTo: string | undefined,
  hideBottomNavigation: boolean,
};

const defaultProps: Partial<PageLayoutProps> = {
    backTo: undefined,
    hideBottomNavigation: false,
};

const ToggleThemeButton = () => {
    const [theme, setTheme] = useAppTheme();

    return (
        <IconButton
            size="large"
            color="inherit"
            onClick={() => setTheme(invertTheme(theme!))}>
            <Brightness6 />
        </IconButton>
    );
};

const PageLayout = ({ children, title, backTo, hideBottomNavigation }: PageLayoutProps) => {
    const router = useRouter();
    const staff = useStaffUser();
    const handleLogout = async () => {
        await signOut(getAuth());
    };

    return (
        <Container maxWidth="md" disableGutters>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
            }}>
                <AppBar position="sticky">
                    <Toolbar>
                        {backTo !== undefined ? (
                            <IconButton
                                size="large"
                                edge="start"
                                color="inherit"
                                onClick={() => router.push(backTo)}
                            >
                                <ArrowBack />
                            </IconButton>
                        ) : (
                            <Avatar src='logo_white.jpg' sx={{ mr: '16px' }} />
                        )}

                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            {title}
                        </Typography>
                        {staff?.isAdmin && (
                            <IconButton
                                onClick={() => router.push('/staffs')}
                                size="large"
                                edge="end"
                                color="inherit"
                                sx={{
                                    marginRight: 0,
                                }}
                            >
                                <AdminPanelSettings />
                            </IconButton>
                        )}
                        <ToggleThemeButton />
                        <IconButton
                            onClick={handleLogout}
                            size="large"
                            edge="end"
                            color="inherit">
                            <Logout />
                        </IconButton>
                    </Toolbar>
                </AppBar>

                <>
                    {children}
                </>

                {!hideBottomNavigation &&
                    <BottomNavigation
                        value={router.pathname}
                        onChange={(e, route) => router.push(route)}
                        showLabels
                        color="inherit"
                    >
                        <BottomNavigationAction value={'/'} label="Comptes" icon={<Groups />} color="inherit" />
                        <BottomNavigationAction value={'/orders'} label="Commandes" icon={<FormatListBulleted />} color="inherit" />
                        <BottomNavigationAction value={'/products'} label="Plats" icon={<FoodBank />} color="inherit" />
                        <BottomNavigationAction value={'/stats'} label="Stats" icon={<QueryStats/>} color="inherit" />
                    </BottomNavigation>
                }
            </Box>
        </Container>
    );
};
PageLayout.defaultProps = defaultProps;

export default PageLayout;
