use crate::database::Database;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub last_active_app: Arc<Mutex<Option<String>>>,
}
