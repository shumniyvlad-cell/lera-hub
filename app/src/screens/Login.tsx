import {useRef, useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {signIn} from '../store';

export function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{field: 'login' | 'password' | 'form'; text: string} | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!login.trim()) { setErr({field: 'login', text: 'Впиши логин'}); return focus('login'); }
    if (!password) { setErr({field: 'password', text: 'Впиши пароль'}); return focus('password'); }
    setBusy(true); setErr(null);
    try {
      await signIn(login, password);
    } catch (e2) {
      setErr({field: 'form', text: e2 instanceof Error ? e2.message : 'Не получилось войти'});
      focus('password');
    } finally { setBusy(false); }
  };
  const focus = (name: string) => requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus());

  return (
    <main className="login">
      <img className="login__img" src="./img/sea.webp" srcSet="./img/sea-960.webp 960w, ./img/sea.webp 1536w" sizes="100vw" alt="" width={1536} height={1024} />
      <form ref={form} onSubmit={submit} noValidate className="login__form glass-photo">
        <VStack gap={6}>
          <VStack gap={3}>
            <img src="./favicon.svg" width={48} height={48} alt="" />
            <Heading level={1}>Штурман</Heading>
            <Text>Все проекты Влада, этапы и план на день. Куда плывём, что горит и где что лежит.</Text>
          </VStack>
          <VStack gap={3}>
            <TextInput label="Логин" htmlName="login" value={login} onChange={setLogin} autoComplete="username"
              hasAutoCorrect={false} autoCapitalize="none" width="100%" hasAutoFocus size="lg"
              status={err?.field === 'login' ? {type: 'error', message: err.text} : undefined} />
            <TextInput label="Пароль" type="password" htmlName="password" value={password} onChange={setPassword}
              autoComplete="current-password" width="100%" size="lg"
              status={err?.field === 'password' || err?.field === 'form' ? {type: 'error', message: err.text} : undefined} />
          </VStack>
          <Button label="Войти" variant="primary" size="lg" width="100%" type="submit" isLoading={busy} />
        </VStack>
      </form>
    </main>
  );
}
