// script.js - Fixed version with better error handling
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';  // CHANGE THIS
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';                // CHANGE THIS

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const authSection = document.getElementById('authSection');
const todoApp = document.getElementById('todoApp');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');
const loginMessage = document.getElementById('loginMessage');
const signupMessage = document.getElementById('signupMessage');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailSpan = document.getElementById('userEmailDisplay');
const newTaskInput = document.getElementById('newTaskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const todoList = document.getElementById('todoList');
const emptyState = document.getElementById('emptyState');
const taskCounter = document.getElementById('taskCounter');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

let currentFilter = 'all';
let todos = [];
let currentUser = null;

function setAuthView(showAuth) {
  if (showAuth) {
    authSection.classList.remove('hidden');
    todoApp.classList.add('hidden');
  } else {
    authSection.classList.add('hidden');
    todoApp.classList.remove('hidden');
  }
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const tab = btn.getAttribute('data-auth-tab');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const loginFormDiv = document.getElementById('loginForm');
    const signupFormDiv = document.getElementById('signupForm');
    if (tab === 'login') {
      loginFormDiv.classList.add('active-form');
      signupFormDiv.classList.remove('active-form');
    } else {
      signupFormDiv.classList.add('active-form');
      loginFormDiv.classList.remove('active-form');
    }
    loginMessage.innerText = '';
    signupMessage.innerText = '';
  });
});

// Signup Handler - FIXED
async function handleSignup(e) {
  e.preventDefault();
  console.log('Signup attempted'); // Debug log
  
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  
  signupMessage.innerText = '';
  signupMessage.style.color = '#ef4444';
  
  if (!email) {
    signupMessage.innerText = 'Please enter your email address.';
    return;
  }
  if (!password) {
    signupMessage.innerText = 'Please enter a password.';
    return;
  }
  if (password.length < 6) {
    signupMessage.innerText = 'Password must be at least 6 characters.';
    return;
  }
  
  try {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    
    if (error) {
      console.error('Signup error:', error);
      signupMessage.innerText = error.message;
      return;
    }
    
    if (data.user) {
      signupMessage.style.color = '#10b981';
      signupMessage.innerText = '✓ Account created successfully! You can now sign in.';
      signupEmail.value = '';
      signupPassword.value = '';
      
      // Switch to login tab after 2 seconds
      setTimeout(() => {
        document.querySelector('.tab-btn[data-auth-tab="login"]').click();
      }, 2000);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    signupMessage.innerText = 'An unexpected error occurred. Please try again.';
  }
}

// Login Handler
async function handleLogin(e) {
  e.preventDefault();
  
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  
  loginMessage.innerText = '';
  
  if (!email || !password) {
    loginMessage.innerText = 'Please enter both email and password.';
    return;
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      loginMessage.innerText = error.message;
      return;
    }
    
    if (data.user) {
      // Success - auth state change will handle UI update
      loginEmail.value = '';
      loginPassword.value = '';
    }
  } catch (err) {
    console.error('Login error:', err);
    loginMessage.innerText = 'Login failed. Please try again.';
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
}

// Todo functions
async function fetchTodos(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching todos:', error);
    return [];
  }
  return data || [];
}

function renderTodoList() {
  let filteredTodos = [...todos];
  if (currentFilter === 'active') {
    filteredTodos = todos.filter(t => !t.is_complete);
  } else if (currentFilter === 'completed') {
    filteredTodos = todos.filter(t => t.is_complete);
  }
  
  const incompleteCount = todos.filter(t => !t.is_complete).length;
  taskCounter.innerText = incompleteCount;
  
  if (filteredTodos.length === 0) {
    todoList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  todoList.innerHTML = '';
  
  filteredTodos.forEach(todo => {
    const li = document.createElement('li');
    li.className = todo.is_complete ? 'completed' : '';
    li.dataset.id = todo.id;
    
    const checkBox = document.createElement('input');
    checkBox.type = 'checkbox';
    checkBox.className = 'todo-check';
    checkBox.checked = todo.is_complete;
    checkBox.addEventListener('change', () => toggleTodoComplete(todo.id, checkBox.checked));
    
    const textSpan = document.createElement('span');
    textSpan.className = 'todo-text';
    textSpan.innerText = todo.task;
    textSpan.addEventListener('dblclick', () => editTodoText(todo.id, todo.task));
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', () => deleteTodo(todo.id));
    
    li.appendChild(checkBox);
    li.appendChild(textSpan);
    li.appendChild(delBtn);
    todoList.appendChild(li);
  });
}

async function addTodo(taskText) {
  if (!currentUser) return;
  const trimmed = taskText.trim();
  if (trimmed === '') return;
  
  const { data, error } = await supabase
    .from('todos')
    .insert([{ task: trimmed, is_complete: false, user_id: currentUser.id }])
    .select()
    .single();
    
  if (error) {
    console.error('Add todo error:', error);
    alert('Could not add task: ' + error.message);
    return;
  }
  
  if (data) {
    todos.unshift(data);
    renderTodoList();
  }
}

async function toggleTodoComplete(todoId, isComplete) {
  const { error } = await supabase
    .from('todos')
    .update({ is_complete: isComplete })
    .eq('id', todoId);
  
  if (!error) {
    const todoIndex = todos.findIndex(t => t.id === todoId);
    if (todoIndex !== -1) {
      todos[todoIndex].is_complete = isComplete;
      renderTodoList();
    }
  }
}

async function deleteTodo(todoId) {
  const { error } = await supabase.from('todos').delete().eq('id', todoId);
  if (!error) {
    todos = todos.filter(t => t.id !== todoId);
    renderTodoList();
  }
}

async function editTodoText(todoId, oldText) {
  const newText = prompt('Edit task:', oldText);
  if (!newText || newText.trim() === '') return;
  
  const { error } = await supabase
    .from('todos')
    .update({ task: newText.trim() })
    .eq('id', todoId);
  
  if (!error) {
    const todo = todos.find(t => t.id === todoId);
    if (todo) todo.task = newText.trim();
    renderTodoList();
  }
}

async function clearCompleted() {
  const completedIds = todos.filter(t => t.is_complete).map(t => t.id);
  if (completedIds.length === 0) return;
  
  const { error } = await supabase.from('todos').delete().in('id', completedIds);
  if (!error) {
    todos = todos.filter(t => !t.is_complete);
    renderTodoList();
  }
}

// Auth state handler
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth event:', event);
  
  if (event === 'SIGNED_IN' && session?.user) {
    currentUser = session.user;
    userEmailSpan.innerText = currentUser.email.split('@')[0] || currentUser.email;
    setAuthView(false);
    
    const userTodos = await fetchTodos(currentUser.id);
    todos = userTodos;
    renderTodoList();
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    todos = [];
    setAuthView(true);
    todoList.innerHTML = '';
    emptyState.style.display = 'block';
    taskCounter.innerText = '0';
  }
});

// Check existing session
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    userEmailSpan.innerText = currentUser.email.split('@')[0] || currentUser.email;
    setAuthView(false);
    const userTodos = await fetchTodos(currentUser.id);
    todos = userTodos;
    renderTodoList();
  } else {
    setAuthView(true);
  }
})();

// Event listeners
loginForm.addEventListener('submit', handleLogin);
signupForm.addEventListener('submit', handleSignup);
logoutBtn.addEventListener('click', handleLogout);

addTaskBtn.addEventListener('click', () => {
  if (newTaskInput.value.trim()) {
    addTodo(newTaskInput.value);
    newTaskInput.value = '';
  }
});

newTaskInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTaskBtn.click();
});

clearCompletedBtn.addEventListener('click', clearCompleted);

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const filterValue = btn.getAttribute('data-filter');
    if (filterValue) {
      currentFilter = filterValue;
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTodoList();
    }
  });
});