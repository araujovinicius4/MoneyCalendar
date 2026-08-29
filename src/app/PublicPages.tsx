import { useState, type FormEvent } from 'react'
import { Link } from './router'
import { yearPath } from './routes'

type LoginScreenProps = {
  readonly onPrototypeLogin: (email: string) => void
}

function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="brand" href="/" aria-label="MoneyCalendar, página inicial">
        <span className="brand-mark">M</span>
        <span>MoneyCalendar</span>
      </Link>
      <nav className="public-nav" aria-label="Navegação principal">
        <a href="/#como-funciona">Como funciona</a>
        <a href="/#recursos">Recursos</a>
        <Link className="public-nav__login" href="/login">Entrar</Link>
      </nav>
    </header>
  )
}

function CalendarPreview() {
  const days = Array.from({ length: 35 }, (_, index) => index < 2 || index > 31 ? null : index - 1)
  return (
    <div className="landing-preview" aria-label="Prévia visual do Money Calendar">
      <div className="landing-preview__bar">
        <span><i /> MoneyCalendar</span><span>Agosto 2026</span>
      </div>
      <div className="landing-preview__metrics">
        <div><span>Faturamento</span><strong>R$ 18.420</strong></div>
        <div><span>Gastos</span><strong>R$ 8.760</strong></div>
        <div><span>Investimentos</span><strong>R$ 4.200</strong></div>
      </div>
      <div className="landing-preview__calendar">
        {['D','S','T','Q','Q','S','S'].map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}
        {days.map((day, index) => <span className={day === 27 ? 'is-today' : day && [4, 8, 13, 19, 25, 27].includes(day) ? 'has-data' : ''} key={index}>{day}</span>)}
      </div>
      <div className="landing-preview__footer"><span>Índice de acumulação</span><strong>0,48</strong><small>R$ 0,48 investidos para cada R$ 1 gasto</small></div>
    </div>
  )
}

export function LandingPage() {
  const currentYear = new Date().getFullYear()
  return (
    <div className="public-page">
      <PublicHeader />
      <main>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">Seu dinheiro, no tempo certo</p>
            <h1>Transforme movimentações em uma visão clara da sua vida financeira.</h1>
            <p className="landing-lead">O Money Calendar organiza entradas, gastos e investimentos dentro do calendário. Você enxerga o ano, entende cada mês e chega até o detalhe de um único dia.</p>
            <div className="landing-actions">
              <Link className="landing-button landing-button--primary" href="/login">Entrar no Money Calendar</Link>
              <Link className="landing-button landing-button--secondary" href={yearPath(currentYear)}>Ver demonstração</Link>
            </div>
            <div className="landing-proof"><span>Importação CSV</span><span>Classificação financeira</span><span>Visão anual, mensal e diária</span></div>
          </div>
          <CalendarPreview />
        </section>

        <section className="landing-statement" id="como-funciona">
          <p className="eyebrow">Uma lógica simples</p>
          <h2>Calendário primeiro. Planilha depois.</h2>
          <p>Em vez de começar por tabelas, o Money Calendar parte de uma pergunta mais natural: <strong>quando o dinheiro entrou, saiu ou foi investido?</strong> A partir daí, os números ganham contexto.</p>
        </section>

        <section className="landing-features" id="recursos">
          <article><span>01</span><h3>Veja o ano inteiro</h3><p>Cada mês funciona como uma pequena janela financeira, com movimentações e indicadores essenciais sem perder a noção do tempo.</p></article>
          <article><span>02</span><h3>Entenda o mês</h3><p>Acompanhe faturamento, receitas, gastos, investimentos, resultado bancário e o índice de acumulação em uma única leitura.</p></article>
          <article><span>03</span><h3>Investigue o dia</h3><p>Abra qualquer data, revise cada movimentação e ajuste a classificação quando o extrato bancário não conta a história completa.</p></article>
          <article><span>04</span><h3>Comece com seu extrato</h3><p>Importe CSV, reconcilie movimentações existentes e mantenha histórico das importações para corrigir ou reverter lotes.</p></article>
        </section>

        <section className="landing-flow">
          <div><p className="eyebrow">Do banco à decisão</p><h2>Menos trabalho para organizar. Mais contexto para decidir.</h2></div>
          <ol><li><b>Importe</b><span>Traga o extrato em CSV.</span></li><li><b>Classifique</b><span>Separe faturamento, receita, gasto, investimento e transferências.</span></li><li><b>Acompanhe</b><span>Leia o comportamento financeiro no calendário.</span></li></ol>
        </section>

        <section className="landing-cta">
          <div><p className="eyebrow">Money Calendar</p><h2>Dinheiro é número. Vida financeira é tempo.</h2><p>Organize os dois no mesmo lugar.</p></div>
          <Link className="landing-button landing-button--primary" href="/login">Acessar minha conta</Link>
        </section>
      </main>
      <footer className="public-footer"><span>MoneyCalendar</span><span>Uma forma temporal de acompanhar suas finanças.</span></footer>
    </div>
  )
}

export function LoginScreen({ onPrototypeLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.includes('@') || password.length < 6) {
      setError('Informe um e-mail válido e uma senha com pelo menos 6 caracteres.')
      return
    }
    onPrototypeLogin(email)
  }

  return (
    <div className="login-page">
      <PublicHeader />
      <main className="login-layout">
        <section className="login-message">
          <p className="eyebrow">Sua área financeira</p>
          <h1>Continue de onde seu dinheiro parou.</h1>
          <p>Entre para acessar seu calendário financeiro. Nesta versão, a tela já está preparada para o fluxo de autenticação; a validação segura de credenciais será conectada ao backend.</p>
          <div className="login-message__note"><strong>Arquitetura preparada para API</strong><span>Sessão, usuário e dados poderão migrar do navegador para o backend sem alterar o motor de cálculos.</span></div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div><p className="eyebrow">Bem-vindo de volta</p><h2 id="login-title">Entrar</h2><p>Use seu e-mail e senha para continuar.</p></div>
          <form onSubmit={submit}>
            <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} placeholder="voce@exemplo.com" /></label>
            <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="••••••••" /></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit">Entrar</button>
          </form>
          <p className="login-prototype-note"><strong>Protótipo:</strong> esta etapa cria apenas uma sessão local de interface. Nenhuma senha é armazenada. A autenticação real depende do backend.</p>
          <Link className="login-back" href="/">← Voltar para a apresentação</Link>
        </section>
      </main>
    </div>
  )
}
