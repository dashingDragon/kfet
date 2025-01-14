import { DocumentReference, addDoc, collection, deleteDoc, doc, getFirestore, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Account, School, accountConverter } from './accounts';
import { useUser } from './hooks';
import { Staff, staffConverter } from './staffs';
import { Transaction, TransactionOrder, TransactionRecharge, TransactionType, transactionConverter } from './transactions';
import { Product, ProductWithQty, productConverter, productType } from './products';
import { Ingredient, ingredientCategory, ingredientConverter } from './ingredients';

// =================== Staff stuff
/**
 * Check if the user is a staff in the database.
 *
 * @returns the currently logged in user as a Staff type
 */
export const useStaffUser = () => {
    const db = getFirestore();
    const user = useUser();
    const [staffUser, setStaffUser] = useState(undefined as Staff | undefined);

    useEffect(() => {
        const q = doc(db, `staffs/${user?.uid}`).withConverter(staffConverter);
        return onSnapshot(q, (snapshot) => {
            const staff = snapshot.data();
            if (!staff) {
                alert('Failed to query staff !');
            } else {
                setStaffUser(staff);
            }
        });
    }, [db, user]);

    return staffUser;
};

/**
 * Fetch the list of staff users in the database.
 *
 * @returns an array of staff types
 */
export const useStaffs = () => {
    const db = getFirestore();
    const user = useStaffUser();
    const [staffs, setStaffs] = useState([] as Staff[]);

    useEffect(() => {
        const q = collection(db, 'staffs').withConverter(staffConverter);
        return onSnapshot(q, (snapshot) => {
            const staffs = snapshot.docs.map((a) => a.data());

            setStaffs(staffs.sort((a, b) => a.name < b.name ? -1 : 1));
        });
    }, [db, user]);

    return staffs;
};

/**
 * Update the availabilty status of a staff.
 *
 * @returns an function to change staffs availability
 */
export const useSetStaffAvailability = () => {
    const db = getFirestore();
    const user = useStaffUser();

    if (!user) return () => alert('Not connected !');

    if (!user.isAdmin) return () => alert('Vous n\'avez pas les permissions !');

    return async (staff: Staff, isAvailable: boolean) => {
        await updateDoc(doc(db, `staffs/${staff.id}`).withConverter(staffConverter), {
            isAvailable,
        });
    };
};

// =================== Stats stuff
/**
 * Return the profits and quantity of products, drinks and snacks sold.
 * Also return the amount of money recharged.
 */
export const useCurrentStats = () => {
    const db = getFirestore();

    const [totalProfits, setTotalProfits] = useState(0);
    const [servingsProfits, setServingsProfits] = useState(0);
    const [drinksProfits, setDrinksProfits] = useState(0);
    const [snacksProfits, setSnacksProfits] = useState(0);

    const [statsProducts] = useCurrentStatsForProducts();

    useEffect(() => {
        if (! statsProducts || !statsProducts.length) {
            return;
        }
        let _servingsProfits = 0, _drinksProfits = 0, _snacksProfits = 0;
        console.log(statsProducts);

        statsProducts.forEach(({ product, quantity, money }) => {
            switch (product.type) {
            case 'serving':
                _servingsProfits += money;
                break;
            case 'drink':
                _drinksProfits += money;
                break;
            case 'snack':
                _snacksProfits += money;
                break;
            }
        });

        setServingsProfits(_servingsProfits);
        setDrinksProfits(_drinksProfits);
        setSnacksProfits(_snacksProfits);
        setTotalProfits(_servingsProfits + _drinksProfits + _snacksProfits);
    }, [statsProducts]);

    return [totalProfits, servingsProfits, drinksProfits, snacksProfits];
};

/**
 * Return the money spent and quantity of products, drinks and snacks bought by a single account.
 * Also return the amount of money recharged.
 */
export const useCurrentStatsForAccount = (account: Account) => {
    const db = getFirestore();
    const products = useProducts();

    const [totalExpense, setTotalExpense] = useState(0);
    const [servingsExpense, setServingsExpense] = useState(0);
    const [drinksExpense, setDrinksExpense] = useState(0);
    const [snacksExpense, setSnacksExpense] = useState(0);

    useEffect(() => {
        const transactionOrder = query(
            collection(db, `transactions`),
            where('type', '==', TransactionType.Order),
            where('customer.id', '==', account.id),
        ).withConverter(transactionConverter);

        return onSnapshot(transactionOrder, (snapshot) => {
            const transactions = snapshot.docs.map((a) => a.data());

            let _servingsExpense = 0, _drinksExpense = 0, _snacksExpense = 0;

            // Setup map
            const _productsStats = new Map();
            products.forEach((p) => {
                _productsStats.set(p.id, { product: p, quantity: 0, money: 0 });
            });

            // Fill it with the transactions
            transactions.forEach((transaction) => {
                const order = transaction as TransactionOrder;
                console.log(order);
                for (let i = 0; i < order.productsWithQty.length; i++) {
                    const id = order.productsWithQty[i].product.id;
                    if (_productsStats.has(id)) {
                        const { product, quantity, money } = _productsStats.get(id);
                        // _productsStats.set(id, {
                        //   product,
                        //   quantity: quantity + order.productsWithQty[i],
                        //   money: money + order.productsWithQty[i].quantity * product.price,
                        // });
                        switch (product.type) {
                        case 'serving':
                            _servingsExpense += order.productsWithQty[i].quantity * product.price;
                            break;
                        case 'drink':
                            _drinksExpense += order.productsWithQty[i].quantity * product.price;
                            break;
                        case 'snack':
                            _snacksExpense += order.productsWithQty[i].quantity * product.price;
                            break;
                        }
                    }
                }
            });

            console.log(_drinksExpense);
            setServingsExpense(_servingsExpense);
            setDrinksExpense(_drinksExpense);
            setSnacksExpense(_snacksExpense);
            setTotalExpense(_servingsExpense + _drinksExpense + _snacksExpense);

        });
    }, [account.id, db, products]);

    return [totalExpense, servingsExpense, drinksExpense, snacksExpense];
};

export const useCurrentStatsForProducts = () => {
    const db = getFirestore();
    const products = useProducts();

    const [productsStats, setProductsStats] = useState(new Map<string, { product: Product, quantity: number, money: number }>());

    useEffect(() => {
        const transactionOrder = query(
            collection(db, `transactions`),
            where('type', '==', TransactionType.Order),
        ).withConverter(transactionConverter);

        return onSnapshot(transactionOrder, (snapshot) => {
            const transactions = snapshot.docs.map((a) => a.data());

            // Setup map
            const _productsStats = new Map();
            products.forEach((p) => {
                _productsStats.set(p.id, { product: p, quantity: 0, money: 0 });
            });

            // Fill it with the transactions
            transactions.forEach((transaction) => {
                const order = transaction as TransactionOrder;
                for (let i = 0; i < order.productsWithQty.length; i++) {
                    const id = order.productsWithQty[i].product.id;
                    if (_productsStats.has(id)) {
                        const { product, quantity, money } = _productsStats.get(id);
                        _productsStats.set(id, {
                            product,
                            quantity: quantity + order.productsWithQty[i],
                            money: money + order.productsWithQty[i].quantity * product.price,
                        });
                    }
                }
            });

            setProductsStats(_productsStats);
        });
    }, [db, products]);

    return [Array.from(productsStats.values())];
};

// =================== Accounts stuff
/**
 * Fetch the accounts list in the database.
 *
 * @returns an array of Account types
 */
export const useAccountList = () => {
    const db = getFirestore();
    const user = useUser();
    const [accounts, setAccounts] = useState([] as Account[]);

    useEffect(() => {
        const q = query(collection(db, 'accounts'), orderBy('lastName', 'asc'), orderBy('firstName', 'asc')).withConverter(accountConverter);
        console.log(q);
        return onSnapshot(q, (snapshot) => {
            setAccounts(snapshot.docs.map((a) => a.data()));
        });
    }, [db, user]);

    return accounts;
};

/**
 * Fetch the account's information from the database.
 *
 * @param id account's id
 * @returns the account matching the specified id
 */
export const useAccount = (id: string) => {
    const db = getFirestore();
    const user = useUser();
    const [account, setAccount] = useState(undefined as Account | undefined);

    useEffect(() => {
        const q = doc(db, `accounts/${id}`).withConverter(accountConverter);
        return onSnapshot(q, (snapshot) => {
            setAccount(snapshot.data());
        });
    }, [db, id, user]);

    return account;
};

/**
 * Get function to make an account.
 *
 * @returns an account maker function
 */
export const useAccountMaker = () => {
    const db = getFirestore();

    return async (firstName: string, lastName: string, school: School) => {
        console.log(`Create account for ${firstName} ${lastName} ${school}`);
        return await addDoc(collection(db, 'accounts').withConverter(accountConverter), {
            id: '0',
            firstName,
            lastName,
            school,
            balance: 0,
        });
    };
};

/**
 * Get the function to edit an account name or school.
 *
 * @returns an edit account function
 */
export const useAccountEditor = () => {
    const db = getFirestore();

    return async (account: Account, firstName: string, lastName: string, school: School) => {
        console.log(`Updating ${firstName} ${lastName}`);
        await updateDoc(doc(db, `accounts/${account.id}`).withConverter(accountConverter), { firstName, lastName, school });
    };
};

/**
 * Get the function to delete an account.
 *
 * @returns a delete account function
 */
export const useAccountDeleter = () => {
    const db = getFirestore();

    return async (account: Account) => {
        console.log(`Deleting ${account.firstName} ${account.lastName}`);
        await deleteDoc(doc(db, `accounts/${account.id}`));
    };
};

// =================== Product stuff
export const useProductMaker = () => {
    const db = getFirestore();
    const staff = useStaffUser();

    if (!staff) return () => alert('Not connected !');

    return async ({ id, type, name, isAvailable, image, price, description, stock }: Product) => {
        console.log('Create product');
        return await addDoc(collection(db, 'products').withConverter(productConverter), {
            id,
            type,
            name,
            isAvailable,
            image,
            price,
            ...(description && {description}),
            ...(stock && {stock}),
        });
    };
};
/**
 * Fetch the list of existing products from the database.
 *
 * @returns an array of Products type
 */
export const useProducts = () => {
    const db = getFirestore();
    const user = useUser();
    const [products, setProducts] = useState([] as Product[]);

    useEffect(() => {
        const q = collection(db, 'products').withConverter(productConverter);
        return onSnapshot(q, (snapshot) => {
            setProducts(snapshot.docs.map((b) => b.data()));
        });
    }, [db, user]);

    return products;
};

/**
 * Get the function to edit a product.
 *
 * @returns an edit product function
 */
export const useProductEditor = () => {
    const db = getFirestore();

    return async (product: Product, type: productType, name: string, isAvailable: boolean, image: string, price: number, description?: string, stock?: number ) => {
        console.log(`Updating ${name}`);
        await updateDoc(doc(db, `products/${product.id}`).withConverter(productConverter), { type, name, isAvailable, image, price, ...(description && {description}), ...(stock !== undefined && {stock}) });
    };
};

/**
 * Get the function to delete a product.
 *
 * @returns a delete account function
 */
export const useProductDeleter = () => {
    const db = getFirestore();

    return async (product: Product) => {
        console.log(`Deleting ${product.name}`);
        await deleteDoc(doc(db, `products/${product.id}`));
    };
};

// =================== Ingredients stuff
export const useIngredientMaker = () => {
    const db = getFirestore();
    const staff = useStaffUser();

    if (!staff) return () => alert('Not connected !');

    return async ({ id, name, category, isVege, isVegan, price, allergen }: Ingredient) => {
        console.log('Create ingredient');
        return await addDoc(collection(db, 'ingredients').withConverter(ingredientConverter), {
            id,
            name,
            category,
            isVege,
            isVegan,
            price,
            allergen,
        });
    };
};

/**
 * Fetch the list of existing ingredients from the database.
 *
 * @returns an array of Ingredients type
 */
export const useIngredients = () => {
    const db = getFirestore();
    const user = useUser();
    const [ingredients, setIngredients] = useState([] as Ingredient[]);

    useEffect(() => {
        const q = collection(db, 'ingredients').withConverter(ingredientConverter);
        return onSnapshot(q, (snapshot) => {
            setIngredients(snapshot.docs.map((b) => b.data()));
        });
    }, [db, user]);

    return ingredients;
};

/**
 * Get the function to edit a ingredient.
 *
 * @returns an edit ingredient function
 */
export const useIngredientEditor = () => {
    const db = getFirestore();

    return async (ingredient: Ingredient, name: string, category: ingredientCategory, isVege: boolean, isVegan: boolean, price: number, allergen: string ) => {
        console.log(`Updating ${name}`);
        await updateDoc(doc(db, `ingredients/${ingredient.id}`).withConverter(ingredientConverter), { name, category, isVege, isVegan, price, allergen });
    };
};

/**
 * Get the function to delete a ingredient.
 *
 * @returns a delete account function
 */
export const useIngredientDeleter = () => {
    const db = getFirestore();

    return async (ingredient: Ingredient) => {
        console.log(`Deleting ${ingredient.name}`);
        await deleteDoc(doc(db, `ingredients/${ingredient.id}`));
    };
};

// =================== Transactions stuff
/**
 * Recharge an account with a given amount.
 *
 * @returns a function to recharge an account
 */
export const useRechargeTransactionMaker = () => {
    const db = getFirestore();
    const staff = useStaffUser();

    if (!staff) return () => alert('Not connected !');

    return async (account: Account, amount: number) => {
        const accountRef = doc(db, `accounts/${account.id}`).withConverter(accountConverter);

        const transactionRef = doc(collection(db, `transactions`)).withConverter(transactionConverter);

        const batch = writeBatch(db);
        batch.set(transactionRef, {
            id: '0',
            type: TransactionType.Recharge,
            amount: amount,
            customer: account,
            staff: staff,
            createdAt: new Date(),
        });
        batch.update(accountRef, {
            balance: account.balance + amount,
        });

        await batch.commit();
    };
};

/**
 * Compute the total amount of money to pay for a certain
 * quantity of a given product.
 *
 * @param product product
 * @param quantity quantity of product
 * @returns the price to pay
 */
export const computeTotalPrice = (product: Product, quantity: number ) => {
    return product?.price * quantity;
};

export const useTransactionHistory = (account: Account) => {
    const db = getFirestore();
    const products = useProducts();

    const [transactions, setTransactions] = useState([] as Transaction[]);

    useEffect(() => {
        const transaction = query(
            collection(db, `transactions`),
            where('customer.id', '==', account.id),
        ).withConverter(transactionConverter);

        return onSnapshot(transaction, (snapshot) => {
            const _transactions = snapshot.docs.map((a) => a.data());
            console.log(_transactions);
            if (_transactions) {
                setTransactions(_transactions);
            }

        });
    }, [account.id, db, products]);

    return transactions;
};

export const useTodaysOrders = () => {
    const db = getFirestore();
    const [transactions, setTransactions] = useState([] as Transaction[]);

    const startOfDay = new Date();
    startOfDay.setHours(7, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(11, 30, 0, 0);

    useEffect(() => {
        const transactionQuery = query(
            collection(db, 'transactions'),
            where('createdAt', '>=', startOfDay),
            where('createdAt', '<', endOfDay)
        ).withConverter(transactionConverter);

        return onSnapshot(transactionQuery, (snapshot) => {
            const _transactions = snapshot.docs.map((a) => a.data());
            console.log(_transactions);
            if (_transactions) {
                setTransactions(_transactions);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    return transactions;
};

export const useUpdateOrderStatus = () => {
    const db = getFirestore();

    return async (transaction: TransactionOrder, isReady: boolean) => {
        console.log(`Updating transaction ${transaction.id} status`);
        await updateDoc(doc(db, `transactions/${transaction.id}`), {
            isReady,
        });
    };
};
