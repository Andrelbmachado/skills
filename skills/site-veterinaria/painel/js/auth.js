/* auth.js: contas e sessão do painel. ATENÇÃO: em um site estático isto é uma BARREIRA DE INTERFACE, não segurança real.
   Contas e hashes ficam no navegador; quem tem acesso ao navegador ou aos arquivos contorna o login.
   O que fazemos: senha nunca em texto claro (sal + PBKDF2/SHA-256), senha mínima de 8 caracteres, primeiro acesso cria o dono,
   funcionários entram com senha provisória que precisa ser trocada. Segurança de verdade = servidor (adaptador do store + autenticação). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Auth = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* SHA-256 em JS puro: usado quando crypto.subtle não existe (páginas fora de contexto seguro). */
  function sha256Hex(msg) {
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = [], i, j;
    var s = unescape(encodeURIComponent(msg));
    for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    var rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64);
      for (i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  function geradorSeguro(cripto) {
    var c = cripto || (typeof crypto !== 'undefined' ? crypto : null);
    if (!c || typeof c.getRandomValues !== 'function') throw new Error('Este navegador não tem gerador de números aleatórios seguro; atualize o navegador.');
    return c;
  }
  function aleatorioHex(n) {
    var a = new Uint8Array(n);
    geradorSeguro().getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  /* senha provisória: 8 caracteres sem i, l, o, 0, 1 (confundem na leitura), sorteados com o gerador criptográfico (sem viés) */
  var ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
  function gerarSenhaProvisoria(cripto) {
    var c = geradorSeguro(cripto), limite = 256 - (256 % ALFABETO.length), s = '';
    while (s.length < 8) {
      var b = new Uint8Array(16); c.getRandomValues(b);
      for (var i = 0; i < b.length && s.length < 8; i++) if (b[i] < limite) s += ALFABETO.charAt(b[i] % ALFABETO.length);
    }
    return 'prov-' + s;
  }
  var temSubtle = function () { return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.importKey === 'function'; };
  var ALGO_PBKDF2 = 'pbkdf2-sha256-100000', ALGO_SHA = 'sha256x3000';

  function hashSenha(senha, sal, algo) {
    algo = algo || (temSubtle() ? ALGO_PBKDF2 : ALGO_SHA);
    if (algo === ALGO_PBKDF2) {
      if (!temSubtle()) return Promise.reject(new Error('Este navegador não consegue verificar essa senha fora de uma página segura (https ou localhost).'));
      var enc = new TextEncoder();
      return crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']).then(function (k) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(sal), iterations: 100000, hash: 'SHA-256' }, k, 256);
      }).then(function (bits) {
        return { algo: ALGO_PBKDF2, hash: Array.prototype.map.call(new Uint8Array(bits), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('') };
      });
    }
    var h = sal + ':' + senha;
    for (var i = 0; i < 3000; i++) h = sha256Hex(h + sal);
    return Promise.resolve({ algo: ALGO_SHA, hash: h });
  }
  function novaSenha(senha, algo) {
    var sal = aleatorioHex(16);
    return hashSenha(senha, sal, algo).then(function (r) { return { sal: sal, hash: r.hash, algo: r.algo }; });
  }
  function conferirSenha(senha, reg) {
    return hashSenha(senha, reg.sal, reg.algo).then(function (r) { return r.hash === reg.hash; });
  }

  var normalizaLogin = function (s) { return String(s || '').trim().toLowerCase(); };

  function existeUsuario(store) { return store.listar('usuarios').then(function (l) { return l.length > 0; }); }

  function criarUsuario(store, dados) {
    var login = normalizaLogin(dados.usuario);
    if (!dados.nome || !dados.nome.trim()) return Promise.reject(new Error('Informe o nome.'));
    if (!/^[a-z0-9._-]{3,}$/.test(login)) return Promise.reject(new Error('Usuário: mínimo de 3 caracteres, só letras, números, ponto, hífen e sublinhado.'));
    if (!dados.senha || dados.senha.length < 8) return Promise.reject(new Error('A senha precisa ter pelo menos 8 caracteres.'));
    return store.listar('usuarios').then(function (l) {
      if (l.some(function (u) { return u.usuario === login; })) throw new Error('Já existe um usuário com esse login.');
      return novaSenha(dados.senha, dados.algo);
    }).then(function (senha) {
      return store.salvar('usuarios', { nome: dados.nome.trim(), usuario: login, perfil: dados.perfil || 'recepcao', senha: senha, ativo: true, trocarSenha: !!dados.trocarSenha });
    });
  }
  function autenticar(store, usuario, senha) {
    var login = normalizaLogin(usuario);
    return store.listar('usuarios').then(function (l) {
      var u = l.find(function (x) { return x.usuario === login; });
      if (!u || u.ativo === false) return conferirSenha(senha || '', { sal: 'x', algo: ALGO_SHA, hash: '' }).then(function () { return null; }); // gasta tempo parecido
      return conferirSenha(senha || '', u.senha).then(function (ok) { return ok ? u : null; });
    });
  }
  function trocarSenha(store, usuarioId, senhaNova, algo) {
    if (!senhaNova || senhaNova.length < 8) return Promise.reject(new Error('A senha precisa ter pelo menos 8 caracteres.'));
    return store.obter('usuarios', usuarioId).then(function (u) {
      if (!u) throw new Error('Usuário não encontrado.');
      return novaSenha(senhaNova, algo).then(function (s) { u.senha = s; u.trocarSenha = false; return store.salvar('usuarios', u); });
    });
  }
  function redefinirSenha(store, usuarioId, senhaProvisoria, algo) {
    return trocarSenha(store, usuarioId, senhaProvisoria, algo).then(function (u) { u.trocarSenha = true; return store.salvar('usuarios', u); });
  }

  /* sessão (sessionStorage): vale por 8 horas ou até fechar a aba */
  var HORAS = 8;
  function chaveSessao(slug) { return 'painel:' + slug + ':sessao'; }
  function iniciarSessao(storage, slug, u, agora) {
    var s = { uid: u.id, nome: u.nome, usuario: u.usuario, perfil: u.perfil, ate: (agora || Date.now()) + HORAS * 3600 * 1000 };
    storage.setItem(chaveSessao(slug), JSON.stringify(s));
    return s;
  }
  function sessaoAtual(storage, slug, agora) {
    try {
      var s = JSON.parse(storage.getItem(chaveSessao(slug)) || 'null');
      if (!s || s.ate < (agora || Date.now())) return null;
      return s;
    } catch (e) { return null; }
  }
  function encerrarSessao(storage, slug) { storage.removeItem(chaveSessao(slug)); }

  return { gerarSenhaProvisoria: gerarSenhaProvisoria, sha256Hex: sha256Hex, hashSenha: hashSenha, novaSenha: novaSenha, conferirSenha: conferirSenha, existeUsuario: existeUsuario, criarUsuario: criarUsuario,
    autenticar: autenticar, trocarSenha: trocarSenha, redefinirSenha: redefinirSenha, iniciarSessao: iniciarSessao, sessaoAtual: sessaoAtual, encerrarSessao: encerrarSessao,
    ALGO_PBKDF2: ALGO_PBKDF2, ALGO_SHA: ALGO_SHA };
});
