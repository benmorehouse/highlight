import React, { useState, useEffect } from 'react';
import './App.css';

import styles from './App.module.css';
import commonStyles from './Common.module.css';
import { Spinner } from './components/Spinner/Spinner';
import { NewMemberPage } from './pages/NewMember/NewMemberPage';
import { NewWorkspacePage } from './pages/NewWorkspace/NewWorkspacePage';
import { auth, googleProvider } from './util/auth';
import { ReactComponent as GoogleLogo } from './static/google.svg';
import { useForm } from 'react-hook-form';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useQuery, gql } from '@apollo/client';
import {
    Switch,
    Route,
    BrowserRouter as Router,
    Redirect,
} from 'react-router-dom';
import { H } from 'highlight.run';
import * as Sentry from '@sentry/react';
import { Integrations } from '@sentry/tracing';
import { OrgRouter } from './OrgRouter';

Sentry.init({
    dsn:
        'https://47f7bc7301cc470799f71a21f1623a34@o473684.ingest.sentry.io/5508861',
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 1.0,
});
H.getSessionURL().then((url) => {
    Sentry.setContext('highlight', { highlightURL: url });
});

const App = () => {
    const { loading: o_loading, error: o_error, data: o_data } = useQuery(gql`
        query GetOrganizations {
            organizations {
                id
            }
        }
    `);

    if (o_error) {
        return <p>{'App error: ' + JSON.stringify(o_error)}</p>;
    }

    if (o_error || o_loading) {
        return (
            <div className={styles.loadingWrapper}>
                <Spinner />
            </div>
        );
    }

    return (
        <div className={styles.appBody}>
            <Router>
                {!o_data.organizations.length ? (
                    <NewWorkspacePage />
                ) : (
                    <Switch>
                        <Route path="/:organization_id/invite/:invite_id">
                            <NewMemberPage />
                        </Route>
                        <Route path="/new">
                            <NewWorkspacePage />
                        </Route>
                        <Route path="/:organization_id">
                            <OrgRouter />
                        </Route>
                        <Route path="/">
                            <Redirect
                                to={`/${o_data?.organizations[0].id}/setup`}
                            />
                        </Route>
                    </Switch>
                )}
            </Router>
        </div>
    );
};

export const AuthAdminRouter = () => {
    const { loading, error, data } = useQuery<{
        admin: { id: string; name: string; email: string };
    }>(gql`
        query GetAdmin {
            admin {
                id
                name
                email
            }
        }
    `);
    const admin = data?.admin;
    useEffect(() => {
        if (admin) {
            const { email, id, name } = admin;
            H.identify(email, { id, name });
            window.analytics.identify(id, {
                name,
                email,
            });
        }
    }, [admin]);
    if (error) {
        return <p>{'AuthAdminRouter error: ' + JSON.stringify(error)}</p>;
    }
    if (loading) {
        return (
            <div className={styles.loadingWrapper}>
                <Spinner />
            </div>
        );
    }
    return <App />;
};

type Inputs = {
    email: string;
    password: string;
};

export const AuthAppRouter = () => {
    const { watch, register, handleSubmit, errors, reset, setError } = useForm<
        Inputs
    >();
    const [signIn, setSignIn] = useState<boolean>(true);
    const [firebaseError, setFirebaseError] = useState('');
    const [user, loading, error] = useAuthState(auth);

    const onSubmit = (data: Inputs) => {
        if (signIn) {
            auth.signInWithEmailAndPassword(data.email, data.password).catch(
                (error) => {
                    setError('password', {
                        type: 'manual',
                        message: error.toString(),
                    });
                }
            );
        } else {
            auth.createUserWithEmailAndPassword(
                data.email,
                data.password
            ).catch((error) => {
                setError('password', {
                    type: 'manual',
                    message: error.toString(),
                });
            });
        }
    };

    const changeState = () => {
        setSignIn(!signIn);
        reset();
    };

    if (loading) {
        return (
            <div className={styles.loadingWrapper}>
                <Spinner />
            </div>
        );
    }

    if (user) {
        return <AuthAdminRouter />;
    }

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginFormWrapper}>
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className={styles.loginForm}
                >
                    <div className={styles.loginTitleWrapper}>
                        <div className={styles.loginTitle}>
                            Welcome {signIn && 'back'} to Highlight.
                        </div>
                        <div className={styles.loginSubTitle}>
                            {signIn ? (
                                <>
                                    New here?{' '}
                                    <span
                                        onClick={changeState}
                                        className={styles.loginStateSwitcher}
                                    >
                                        Create an account.
                                    </span>
                                </>
                            ) : (
                                <>
                                    Already have an account?{' '}
                                    <span
                                        onClick={changeState}
                                        className={styles.loginStateSwitcher}
                                    >
                                        Sign in.
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <input
                        placeholder={'Email'}
                        name="email"
                        ref={register({ required: true })}
                        className={commonStyles.input}
                    />
                    <div className={commonStyles.errorMessage}>
                        {errors.email && 'Enter an email yo!'}
                    </div>
                    <input
                        placeholder={'Password'}
                        type="password"
                        name="password"
                        ref={register({ required: true })}
                        className={commonStyles.input}
                    />
                    {!signIn && (
                        <>
                            <input
                                placeholder={'Confirm Password'}
                                type="password"
                                name="confirm-password"
                                ref={register({
                                    required: true,
                                    validate: (value) => {
                                        if (value !== watch('password')) {
                                            setError('password', {
                                                type: 'mismatch',
                                                message: 'Mismatched passwords',
                                            });
                                            return "Passwords don't match.";
                                        }
                                    },
                                })}
                                className={commonStyles.input}
                            />
                        </>
                    )}
                    <div className={commonStyles.errorMessage}>
                        {errors.password && errors.password.message}
                    </div>
                    <button className={commonStyles.submitButton} type="submit">
                        {signIn ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>
                <div className={styles.otherSigninText}>
                    or sign {signIn ? 'in' : 'up'} with
                </div>
                <div
                    className={commonStyles.secondaryButton}
                    onClick={() => {
                        auth.signInWithRedirect(googleProvider).catch((e) =>
                            setFirebaseError(JSON.stringify(e))
                        );
                    }}
                >
                    <GoogleLogo className={styles.googleLogoStyle} />
                    <span className={styles.googleText}>
                        Google Sign {signIn ? 'In' : 'Up'}
                    </span>
                </div>
                <div className={commonStyles.errorMessage}>{firebaseError}</div>
                <div className={commonStyles.errorMessage}>
                    {JSON.stringify(error)}
                </div>
            </div>
        </div>
    );
};

export default App;
