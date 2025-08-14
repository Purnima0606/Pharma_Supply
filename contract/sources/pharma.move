module pharma_supply_chain::supply_chain {
    use std::signer;
    use std::vector;
    use std::string::String;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // Errors
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_PRODUCT_NOT_FOUND: u64 = 2;
    const E_INVALID_STATUS: u64 = 3;

    // Product status enum
    const STATUS_MANUFACTURED: u8 = 1;
    const STATUS_IN_TRANSIT: u8 = 2;
    const STATUS_DELIVERED: u8 = 3;
    const STATUS_DISPENSED: u8 = 4;

    struct Product has key, store {
        id: String,
        name: String,
        manufacturer: address,
        batch_number: String,
        manufacturing_date: u64,
        expiry_date: u64,
        current_holder: address,
        status: u8,
        temperature_log: vector<TemperatureReading>,
        compliance_verified: bool,
    }

    struct TemperatureReading has store, drop {
        timestamp: u64,
        temperature: u64, // Temperature in Celsius * 100
        location: String,
    }

    struct SupplyChainRegistry has key {
        products: vector<Product>,
        authorized_parties: vector<address>,
    }

    // Events
    #[event]
    struct ProductCreated has drop, store {
        product_id: String,
        manufacturer: address,
        timestamp: u64,
    }

    #[event]
    struct ProductTransferred has drop, store {
        product_id: String,
        from: address,
        to: address,
        timestamp: u64,
    }

    #[event]
    struct TemperatureLogged has drop, store {
        product_id: String,
        temperature: u64,
        timestamp: u64,
    }

    // Initialize the supply chain registry
    public entry fun initialize(account: &signer) {
        let registry = SupplyChainRegistry {
            products: vector::empty(),
            authorized_parties: vector::empty(),
        };
        move_to(account, registry);
    }

    // Create a new pharmaceutical product
    public entry fun create_product(
        manufacturer: &signer,
        id: String,
        name: String,
        batch_number: String,
        manufacturing_date: u64,
        expiry_date: u64,
    ) acquires SupplyChainRegistry {
        let manufacturer_addr = signer::address_of(manufacturer);
        let registry = borrow_global_mut<SupplyChainRegistry>(@pharma_supply_chain);
        
        let product = Product {
            id: id,
            name: name,
            manufacturer: manufacturer_addr,
            batch_number: batch_number,
            manufacturing_date: manufacturing_date,
            expiry_date: expiry_date,
            current_holder: manufacturer_addr,
            status: STATUS_MANUFACTURED,
            temperature_log: vector::empty(),
            compliance_verified: false,
        };

        vector::push_back(&mut registry.products, product);

        event::emit(ProductCreated {
            product_id: id,
            manufacturer: manufacturer_addr,
            timestamp: timestamp::now_microseconds(),
        });
    }

    // Transfer product to another party
    public entry fun transfer_product(
        current_holder: &signer,
        product_id: String,
        new_holder: address,
    ) acquires SupplyChainRegistry {
        let current_holder_addr = signer::address_of(current_holder);
        let registry = borrow_global_mut<SupplyChainRegistry>(@pharma_supply_chain);
        
        let products = &mut registry.products;
        let i = 0;
        let len = vector::length(products);
        let found = false;

        while (i < len && !found) {
            let product = vector::borrow_mut(products, i);
            if (product.id == product_id) {
                assert!(product.current_holder == current_holder_addr, E_NOT_AUTHORIZED);
                product.current_holder = new_holder;
                product.status = STATUS_IN_TRANSIT;
                found = true;

                event::emit(ProductTransferred {
                    product_id: product_id,
                    from: current_holder_addr,
                    to: new_holder,
                    timestamp: timestamp::now_microseconds(),
                });
            };
            i = i + 1;
        };

        assert!(found, E_PRODUCT_NOT_FOUND);
    }

    // Log temperature reading from IoT sensors
    public entry fun log_temperature(
        _account: &signer,
        product_id: String,
        temperature: u64,
        location: String,
    ) acquires SupplyChainRegistry {
        let registry = borrow_global_mut<SupplyChainRegistry>(@pharma_supply_chain);
        let products = &mut registry.products;
        let i = 0;
        let len = vector::length(products);
        let found = false;

        while (i < len && !found) {
            let product = vector::borrow_mut(products, i);
            if (product.id == product_id) {
                let reading = TemperatureReading {
                    timestamp: timestamp::now_microseconds(),
                    temperature: temperature,
                    location: location,
                };
                vector::push_back(&mut product.temperature_log, reading);
                found = true;

                event::emit(TemperatureLogged {
                    product_id: product_id,
                    temperature: temperature,
                    timestamp: timestamp::now_microseconds(),
                });
            };
            i = i + 1;
        };

        assert!(found, E_PRODUCT_NOT_FOUND);
    }

    // Mark compliance as verified
    public entry fun verify_compliance(
        _auditor: &signer,
        product_id: String,
    ) acquires SupplyChainRegistry {
        let registry = borrow_global_mut<SupplyChainRegistry>(@pharma_supply_chain);
        let products = &mut registry.products;
        let i = 0;
        let len = vector::length(products);
        let found = false;

        while (i < len && !found) {
            let product = vector::borrow_mut(products, i);
            if (product.id == product_id) {
                product.compliance_verified = true;
                found = true;
            };
            i = i + 1;
        };

        assert!(found, E_PRODUCT_NOT_FOUND);
    }
}
